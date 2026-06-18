import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CONTENT_AREAS, type ContentAreaKey } from "@/lib/exam";

const areaEnum = z.enum(["human_development","assessment_diagnosis","psychotherapy_interventions","ethics_values"]);

const questionInput = z.object({
  id: z.string().uuid().optional(),
  content_area: areaEnum,
  sub_topic: z.string().optional().nullable(),
  stem: z.string().min(5),
  choices: z.array(z.string().min(1)).length(4),
  correct_index: z.number().int().min(0).max(3),
  rationale: z.string().min(3),
  difficulty: z.number().int().min(1).max(5).default(2),
  source: z.string().optional().nullable(),
  status: z.enum(["draft", "published"]).default("draft"),
});

async function requireAdmin(context: { supabase: { rpc: (...args: unknown[]) => unknown }; userId: string }) {
  const rpc = context.supabase.rpc as unknown as (n: string, a: object) => Promise<{ data: boolean | null; error: unknown }>;
  const { data, error } = await rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw error;
  if (!data) throw new Error("Admin access required.");
}

export const listQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ area: areaEnum.optional(), status: z.enum(["draft","published","all"]).default("all"), q: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    let qb = context.supabase.from("questions").select("*").order("created_at", { ascending: false }).limit(500);
    if (data.area) qb = qb.eq("content_area", data.area);
    if (data.status !== "all") qb = qb.eq("status", data.status);
    if (data.q) qb = qb.ilike("stem", `%${data.q}%`);
    const { data: rows, error } = await qb;
    if (error) throw error;
    return rows ?? [];
  });

export const upsertQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => questionInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const payload = { ...data, created_by: context.userId };
    const res = data.id
      ? await context.supabase.from("questions").update(payload).eq("id", data.id).select().single()
      : await context.supabase.from("questions").insert(payload).select().single();
    if (res.error) throw res.error;
    return res.data;
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("questions").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const csvRow = z.object({
  content_area: areaEnum,
  sub_topic: z.string().optional().nullable(),
  stem: z.string(),
  choice_a: z.string(), choice_b: z.string(), choice_c: z.string(), choice_d: z.string(),
  correct_index: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  rationale: z.string(),
  difficulty: z.union([z.string(), z.number()]).optional().transform((v) => (v == null || v === "" ? 2 : Number(v))),
  source: z.string().optional().nullable(),
  status: z.enum(["draft", "published"]).optional().default("draft"),
});

export const bulkImportQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const inserts: Array<{ content_area: ContentAreaKey; sub_topic: string | null; stem: string; choices: string[]; correct_index: number; rationale: string; difficulty: number; source: string | null; status: "draft" | "published"; created_by: string }> = [];
    const errors: { row: number; error: string }[] = [];
    data.rows.forEach((raw, i) => {
      const r = csvRow.safeParse(raw);
      if (!r.success) { errors.push({ row: i + 1, error: r.error.issues[0]?.message ?? "invalid" }); return; }
      inserts.push({
        content_area: r.data.content_area,
        sub_topic: r.data.sub_topic ?? null,
        stem: r.data.stem,
        choices: [r.data.choice_a, r.data.choice_b, r.data.choice_c, r.data.choice_d],
        correct_index: r.data.correct_index,
        rationale: r.data.rationale,
        difficulty: r.data.difficulty ?? 2,
        source: r.data.source ?? "CSV import",
        status: r.data.status ?? "draft",
        created_by: context.userId,
      });
    });
    if (inserts.length) {
      const { error } = await context.supabase.from("questions").insert(inserts);
      if (error) throw error;
    }
    return { inserted: inserts.length, errors };
  });

export const draftQuestionWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ content_area: areaEnum, sub_topic: z.string().min(2), difficulty: z.number().int().min(1).max(5).default(3) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway is not configured.");
    const areaLabel = CONTENT_AREAS.find((a) => a.key === data.content_area)?.label ?? data.content_area;
    const system = `You are an item-writer for the ASWB Clinical (LCSW) licensing exam. Produce one original, blueprint-aligned multiple-choice item. Use real clinical scenarios, plausible distractors, and a concise rationale citing standard practice (NASW Code of Ethics, DSM-5-TR, evidence-based interventions). Do NOT reproduce copyrighted ASWB items.`;
    const user = `Content area: ${areaLabel}\nSub-topic: ${data.sub_topic}\nTarget difficulty (1-5): ${data.difficulty}\n\nReturn STRICT JSON only with this shape: {"stem": string, "choices": [string, string, string, string], "correct_index": 0|1|2|3, "rationale": string}.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("AI rate limit reached — please retry shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    if (!res.ok) throw new Error(`AI error ${res.status}`);
    const json = await res.json() as { choices: { message: { content: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { stem: string; choices: string[]; correct_index: number; rationale: string };

    const inserted = await context.supabase.from("questions").insert({
      content_area: data.content_area,
      sub_topic: data.sub_topic,
      stem: parsed.stem,
      choices: parsed.choices,
      correct_index: parsed.correct_index,
      rationale: parsed.rationale,
      difficulty: data.difficulty,
      source: "AI-drafted — review before publish",
      status: "draft",
      created_by: context.userId,
    }).select().single();
    if (inserted.error) throw inserted.error;
    return inserted.data;
  });
