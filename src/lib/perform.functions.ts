/**
 * perform.functions.ts
 * Server functions for Boost!Perform module.
 * Covers: targets (NOT goals), reviews, review sections, kudos (no flight_risk auto-set),
 *         coach sessions (manager-only), potential ratings, manager effectiveness (admin-only).
 *
 * Auth pattern: requireSupabaseAuth middleware → context.supabase + context.userId
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveTenant(sb: any, slug: string) {
  const { data: tenant, error } = await sb
    .from("tenants")
    .select("id, slug, name, modules_enabled")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tenant) throw new Error("NotFound");
  return tenant;
}

async function getCallerRoles(sb: any, userId: string, tenantId: string) {
  const { data: pRows } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const { data: mRows } = await sb
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  const pRoles = (pRows ?? []).map((r: any) => r.role as string);
  const mRoles = (mRows ?? []).map((m: any) => m.role as string);
  return [...pRoles, ...mRoles];
}

async function requireRoles(sb: any, userId: string, tenantId: string, allowed: string[]) {
  const roles = await getCallerRoles(sb, userId, tenantId);
  if (roles.length === 0) throw new Error("Forbidden");
  if (!roles.some((r) => allowed.includes(r))) throw new Error("Forbidden: insufficient role");
}

async function resolveLearner(sb: any, userId: string) {
  const { data, error } = await sb
    .from("learners")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Learner profile not found");
  return data;
}

// ---------------------------------------------------------------------------
// Targets (NOT goals — table is perform_targets)
// ---------------------------------------------------------------------------

export const listTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ slug: z.string().min(1), employee_id: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const isPrivileged = roles.some((r) =>
      ["super_admin", "bsg_admin", "tenant_admin", "admin", "manager"].includes(r),
    );

    let query = sb
      .from("perform_targets")
      .select("*")
      .eq("tenant_id", tenant.id);

    if (!isPrivileged) {
      // Learners see only their own targets
      const learner = await resolveLearner(sb, context.userId);
      query = query.eq("employee_id", learner.id);
    } else if (data.employee_id) {
      query = query.eq("employee_id", data.employee_id);
    }

    const { data: targets, error } = await query.order("due_date", { ascending: true });
    if (error) throw new Error(error.message);
    return targets ?? [];
  });

export const updateTargetProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        target_id: z.string().uuid(),
        progress_pct: z.number().min(0).max(100),
        slug: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const newStatus = data.progress_pct === 100 ? "completed" : "active";
    const { error } = await sb
      .from("perform_targets")
      .update({ progress_pct: data.progress_pct, status: newStatus })
      .eq("id", data.target_id)
      .eq("tenant_id", tenant.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ---------------------------------------------------------------------------
// Reviews & Review Sections
// ---------------------------------------------------------------------------

export const listReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ slug: z.string().min(1), employee_id: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const isPrivileged = roles.some((r) =>
      ["super_admin", "bsg_admin", "tenant_admin", "admin", "manager"].includes(r),
    );

    let query = sb
      .from("perform_reviews")
      .select("*")
      .eq("tenant_id", tenant.id);

    if (!isPrivileged) {
      const learner = await resolveLearner(sb, context.userId);
      query = query.eq("employee_id", learner.id).eq("status", "complete");
    } else if (data.employee_id) {
      query = query.eq("employee_id", data.employee_id);
    }

    const { data: reviews, error } = await query.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return reviews ?? [];
  });

export const listReviewSections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    await requireRoles(sb, context.userId, tenant.id, [
      "super_admin", "bsg_admin", "tenant_admin", "admin", "manager",
    ]);

    const { data: sections, error } = await sb
      .from("perform_review_sections")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return sections ?? [];
  });

// ---------------------------------------------------------------------------
// Kudos — flight_risk_flag NEVER auto-set
// ---------------------------------------------------------------------------

export const listKudos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const isSuperAdmin = roles.includes("super_admin");

    let query = sb
      .from("kudos")
      .select(
        isSuperAdmin
          ? "*, giver:learners!kudos_giver_id_fkey(first_name, last_name), receiver:learners!kudos_receiver_id_fkey(first_name, last_name)"
          : "id, tenant_id, message, category, is_public, created_at, giver:learners!kudos_giver_id_fkey(first_name, last_name), receiver:learners!kudos_receiver_id_fkey(first_name, last_name)",
      )
      .eq("tenant_id", tenant.id)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: kudos, error } = await query;
    if (error) throw new Error(error.message);
    return kudos ?? [];
  });

export const sendKudos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        slug: z.string().min(1),
        receiver_id: z.string().uuid(),
        message: z.string().min(10).max(500),
        category: z.enum(["Innovation", "Teamwork", "Leadership", "Going Above & Beyond"]),
        is_public: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const giver = await resolveLearner(sb, context.userId);

    const { error } = await sb.from("kudos").insert({
      tenant_id: tenant.id,
      giver_id: giver.id,
      receiver_id: data.receiver_id,
      message: data.message,
      category: data.category,
      is_public: data.is_public,
      flight_risk_flag: false, // NEVER auto-set — requires human admin action
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ---------------------------------------------------------------------------
// Conversation Coach Sessions — manager-only
// ---------------------------------------------------------------------------

export const listCoachSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ slug: z.string().min(1), employee_id: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    await requireRoles(sb, context.userId, tenant.id, [
      "super_admin", "bsg_admin", "tenant_admin", "admin", "manager",
    ]);

    const learner = await resolveLearner(sb, context.userId);

    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    const isAdmin = roles.some((r) =>
      ["super_admin", "bsg_admin", "tenant_admin", "admin"].includes(r),
    );

    let query = sb
      .from("conversation_coach_sessions")
      .select("*")
      .eq("tenant_id", tenant.id);

    if (!isAdmin) {
      // Managers see only their own sessions
      query = query.eq("manager_id", learner.id);
    }
    if (data.employee_id) query = query.eq("employee_id", data.employee_id);

    const { data: sessions, error } = await query.order("session_date", { ascending: false });
    if (error) throw new Error(error.message);
    return sessions ?? [];
  });

// ---------------------------------------------------------------------------
// Potential Ratings — manager+/admin
// ---------------------------------------------------------------------------

export const getPotentialRatings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ slug: z.string().min(1), employee_id: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    await requireRoles(sb, context.userId, tenant.id, [
      "super_admin", "bsg_admin", "tenant_admin", "admin", "manager",
    ]);

    let query = sb
      .from("potential_ratings")
      .select("*, employee:learners!potential_ratings_employee_id_fkey(first_name, last_name, job_title)")
      .eq("tenant_id", tenant.id);
    if (data.employee_id) query = query.eq("employee_id", data.employee_id);

    const { data: ratings, error } = await query.order("rated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ratings ?? [];
  });

// ---------------------------------------------------------------------------
// Manager Effectiveness Scores — admin-only; managers do NOT see own score
// ---------------------------------------------------------------------------

export const getManagerEffectivenessScores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    await requireRoles(sb, context.userId, tenant.id, [
      "super_admin", "bsg_admin", "tenant_admin", "admin",
    ]);

    const { data: scores, error } = await sb
      .from("manager_effectiveness_scores")
      .select("*, manager:learners!manager_effectiveness_scores_manager_id_fkey(first_name, last_name, job_title)")
      .eq("tenant_id", tenant.id)
      .order("period", { ascending: false });
    if (error) throw new Error(error.message);
    return scores ?? [];
  });

// ---------------------------------------------------------------------------
// Tenant Learners (for kudos receiver picker)
// ---------------------------------------------------------------------------

export const listTenantLearners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    // Get user IDs that are tenant members
    const { data: members } = await sb
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", tenant.id);
    const userIds = (members ?? []).map((m: any) => m.user_id);

    const { data: learners, error } = await sb
      .from("learners")
      .select("id, first_name, last_name, job_title")
      .in("user_id", userIds)
      .neq("user_id", context.userId) // exclude self
      .order("first_name");
    if (error) throw new Error(error.message);
    return learners ?? [];
  });
