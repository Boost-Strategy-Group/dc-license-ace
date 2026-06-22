import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Apprenticeship programs ----------

export const listApprenticeshipPrograms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().uuid().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("apprenticeship_programs")
      .select("id, tenant_id, name, required_rti_hours, created_at")
      .order("name", { ascending: true });
    if (data.tenantId) q = q.eq("tenant_id", data.tenantId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertApprenticeshipProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      tenant_id: z.string().uuid(),
      name: z.string().min(1),
      required_rti_hours: z.number().int().nonnegative(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("apprenticeship_programs").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Roster + RTI rollups ----------

export const listTenantApprentices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: learners, error } = await context.supabase
      .from("learners")
      .select("id, user_id, tenant_id, apprenticeship_program_id, is_apprentice")
      .eq("tenant_id", data.tenantId)
      .eq("is_apprentice", true);
    if (error) throw new Error(error.message);
    const ids = (learners ?? []).map((l) => l.id);
    const userIds = (learners ?? []).map((l) => l.user_id);
    const progIds = Array.from(new Set((learners ?? []).map((l) => l.apprenticeship_program_id).filter(Boolean))) as string[];

    const [{ data: rtis }, { data: profs }, { data: progs }] = await Promise.all([
      ids.length
        ? context.supabase.from("rti_completions").select("learner_id, rti_hours, completed_at, course_id").in("learner_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? context.supabase.from("profiles").select("id, full_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      progIds.length
        ? context.supabase.from("apprenticeship_programs").select("id, name, required_rti_hours").in("id", progIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
    const progMap = new Map((progs ?? []).map((p: any) => [p.id, p]));
    return (learners ?? []).map((l) => {
      const mine = (rtis ?? []).filter((r: any) => r.learner_id === l.id);
      const total = mine.reduce((a, r: any) => a + Number(r.rti_hours || 0), 0);
      const prog: any = l.apprenticeship_program_id ? progMap.get(l.apprenticeship_program_id) : null;
      return {
        learner_id: l.id,
        user_id: l.user_id,
        full_name: profMap.get(l.user_id) ?? null,
        program_id: l.apprenticeship_program_id,
        program_name: prog?.name ?? null,
        required_hours: prog?.required_rti_hours ?? 0,
        completed_hours: total,
        last_activity: mine.map((r: any) => r.completed_at).sort().at(-1) ?? null,
      };
    });
  });

// ---------- Learner self-view ----------

export const getMyRti = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: learners, error } = await context.supabase
      .from("learners")
      .select("id, tenant_id, apprenticeship_program_id, is_apprentice")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const records = [];
    for (const l of learners ?? []) {
      if (!l.is_apprentice) continue;
      const [{ data: rtis }, { data: prog }] = await Promise.all([
        context.supabase
          .from("rti_completions")
          .select("id, rti_hours, completed_at, course_id, courses:courses(title)")
          .eq("learner_id", l.id)
          .order("completed_at", { ascending: false }),
        l.apprenticeship_program_id
          ? context.supabase
              .from("apprenticeship_programs")
              .select("id, name, required_rti_hours")
              .eq("id", l.apprenticeship_program_id)
              .maybeSingle()
          : Promise.resolve({ data: null as any }),
      ]);
      const completions = (rtis ?? []).map((r: any) => ({
        id: r.id,
        rti_hours: Number(r.rti_hours),
        completed_at: r.completed_at,
        course_title: r.courses?.title ?? "Course",
      }));
      const total = completions.reduce((a, r) => a + r.rti_hours, 0);
      records.push({
        learner_id: l.id,
        program: prog ?? null,
        completed_hours: total,
        required_hours: (prog as any)?.required_rti_hours ?? 0,
        completions,
      });
    }
    return records;
  });

// ---------- CSV export (GoSprout-compatible) ----------

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const exportRtiCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: learners, error } = await context.supabase
      .from("learners")
      .select("id, user_id, apprenticeship_program_id")
      .eq("tenant_id", data.tenantId)
      .eq("is_apprentice", true);
    if (error) throw new Error(error.message);
    const ids = (learners ?? []).map((l) => l.id);
    if (!ids.length) {
      return { filename: `rti-export-${data.tenantId}.csv`, csv: "learner_id,full_name,program,course,rti_hours,completed_at\n" };
    }
    const [{ data: rtis }, { data: profs }, { data: progs }] = await Promise.all([
      context.supabase
        .from("rti_completions")
        .select("learner_id, rti_hours, completed_at, course_id, courses:courses(title)")
        .in("learner_id", ids),
      context.supabase.from("profiles").select("id, full_name").in("id", (learners ?? []).map((l) => l.user_id)),
      context.supabase
        .from("apprenticeship_programs")
        .select("id, name")
        .in(
          "id",
          Array.from(new Set((learners ?? []).map((l) => l.apprenticeship_program_id).filter(Boolean))) as string[],
        ),
    ]);

    const learnerMap = new Map((learners ?? []).map((l: any) => [l.id, l]));
    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
    const progMap = new Map((progs ?? []).map((p: any) => [p.id, p.name]));

    const header = "learner_id,full_name,program,course,rti_hours,completed_at";
    const lines = (rtis ?? []).map((r: any) => {
      const l: any = learnerMap.get(r.learner_id);
      return [
        r.learner_id,
        profMap.get(l?.user_id) ?? "",
        l?.apprenticeship_program_id ? progMap.get(l.apprenticeship_program_id) ?? "" : "",
        r.courses?.title ?? "",
        r.rti_hours,
        r.completed_at,
      ].map(csvCell).join(",");
    });
    const csv = [header, ...lines].join("\n") + "\n";
    return { filename: `rti-export-${data.tenantId}-${new Date().toISOString().slice(0, 10)}.csv`, csv };
  });
