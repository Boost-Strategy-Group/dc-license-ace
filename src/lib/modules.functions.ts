import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- helpers ----------
async function resolveTenantId(
  supabase: any,
  userId: string,
  preferred?: string | null,
): Promise<string> {
  if (preferred) return preferred;
  const { data } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!data?.tenant_id) throw new Error("No tenant membership found");
  return data.tenant_id as string;
}

// ============ ROLES ============
export const listJobDescriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const tid = await resolveTenantId(context.supabase, context.userId, data.tenantId);
    const { data: rows, error } = await context.supabase
      .from("job_descriptions")
      .select("id, title, summary, status, created_at")
      .eq("tenant_id", tid)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tenantId: tid, rows: rows ?? [] };
  });

export const createJobDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      tenantId: z.string().uuid().optional(),
      title: z.string().min(1),
      summary: z.string().optional(),
      responsibilities: z.string().optional(),
      qualifications: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const tid = await resolveTenantId(context.supabase, context.userId, data.tenantId);
    const { data: row, error } = await context.supabase
      .from("job_descriptions")
      .insert({
        tenant_id: tid,
        title: data.title,
        summary: data.summary ?? null,
        responsibilities: data.responsibilities ?? null,
        qualifications: data.qualifications ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listOrgNodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const tid = await resolveTenantId(context.supabase, context.userId, data.tenantId);
    const { data: rows, error } = await context.supabase
      .from("org_chart_nodes")
      .select("id, parent_id, title, employee_id, sort_order")
      .eq("tenant_id", tid)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return { tenantId: tid, rows: rows ?? [] };
  });

// ============ EMPLOYEES ============
export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const tid = await resolveTenantId(context.supabase, context.userId, data.tenantId);
    const { data: rows, error } = await context.supabase
      .from("employees")
      .select("id, full_name, email, job_title, department, hire_date")
      .eq("tenant_id", tid)
      .order("full_name");
    if (error) throw new Error(error.message);
    return { tenantId: tid, rows: rows ?? [] };
  });

export const upsertEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      tenantId: z.string().uuid().optional(),
      full_name: z.string().min(1),
      email: z.string().email().optional().or(z.literal("")),
      job_title: z.string().optional(),
      department: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const tid = await resolveTenantId(context.supabase, context.userId, data.tenantId);
    const payload = {
      tenant_id: tid,
      full_name: data.full_name,
      email: data.email || null,
      job_title: data.job_title || null,
      department: data.department || null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("employees").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("employees").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

// ============ PERFORM ============
export const listGoalCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const tid = await resolveTenantId(context.supabase, context.userId, data.tenantId);
    const { data: rows, error } = await context.supabase
      .from("perform_goal_categories")
      .select("id, name, description, weight")
      .eq("tenant_id", tid)
      .order("name");
    if (error) throw new Error(error.message);
    return { tenantId: tid, rows: rows ?? [] };
  });

export const createGoalCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      tenantId: z.string().uuid().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
      weight: z.number().min(0).default(1),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const tid = await resolveTenantId(context.supabase, context.userId, data.tenantId);
    const { data: row, error } = await context.supabase
      .from("perform_goal_categories")
      .insert({
        tenant_id: tid, name: data.name,
        description: data.description ?? null, weight: data.weight,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listReviewCycles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const tid = await resolveTenantId(context.supabase, context.userId, data.tenantId);
    const { data: rows, error } = await context.supabase
      .from("perform_review_cycles")
      .select("id, name, status, starts_at, ends_at")
      .eq("tenant_id", tid)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tenantId: tid, rows: rows ?? [] };
  });

export const createReviewCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      tenantId: z.string().uuid().optional(),
      name: z.string().min(1),
      starts_at: z.string().optional(),
      ends_at: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const tid = await resolveTenantId(context.supabase, context.userId, data.tenantId);
    const { data: row, error } = await context.supabase
      .from("perform_review_cycles")
      .insert({
        tenant_id: tid, name: data.name,
        starts_at: data.starts_at ?? null, ends_at: data.ends_at ?? null,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

// ============ PULSE ============
export const getPulseCadence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const tid = await resolveTenantId(context.supabase, context.userId, data.tenantId);
    const { data: row } = await context.supabase
      .from("pulse_cadences").select("id, cadence, active").eq("tenant_id", tid).maybeSingle();
    return { tenantId: tid, cadence: row?.cadence ?? "monthly", active: row?.active ?? false, id: row?.id ?? null };
  });

export const setPulseCadence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      tenantId: z.string().uuid().optional(),
      cadence: z.enum(["weekly", "biweekly", "monthly", "quarterly"]),
      active: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const tid = await resolveTenantId(context.supabase, context.userId, data.tenantId);
    const { data: existing } = await context.supabase
      .from("pulse_cadences").select("id").eq("tenant_id", tid).maybeSingle();
    if (existing) {
      const { error } = await context.supabase
        .from("pulse_cadences")
        .update({ cadence: data.cadence, active: data.active ?? false })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: existing.id };
    }
    const { data: row, error } = await context.supabase
      .from("pulse_cadences")
      .insert({ tenant_id: tid, cadence: data.cadence, active: data.active ?? false })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

// ============ APPROVALS ============
export const listApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const tid = await resolveTenantId(context.supabase, context.userId, data.tenantId);
    const { data: rows, error } = await context.supabase
      .from("approval_requests")
      .select("id, kind, status, payload, created_at, confirmed_at, confirmed_by_email")
      .eq("tenant_id", tid)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { tenantId: tid, rows: rows ?? [] };
  });

export const createApprovalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      tenantId: z.string().uuid().optional(),
      kind: z.string().min(1),
      target_id: z.string().uuid().optional(),
      payload: z.record(z.any()).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const tid = await resolveTenantId(context.supabase, context.userId, data.tenantId);
    const { data: row, error } = await context.supabase
      .from("approval_requests")
      .insert({
        tenant_id: tid,
        requested_by: context.userId,
        kind: data.kind,
        target_id: data.target_id ?? null,
        payload: data.payload ?? {},
      })
      .select("id, email_token")
      .single();
    if (error) throw new Error(error.message);
    // Email send would be wired via /lovable/email/transactional/send in a follow-up.
    return { id: row.id, email_token: row.email_token };
  });

export const confirmApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("approval_requests").select("tenant_id").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Approval not found");
    const { data: u } = await context.supabase.auth.getUser();
    const { error } = await context.supabase
      .from("approval_requests")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by_email: u?.user?.email ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
