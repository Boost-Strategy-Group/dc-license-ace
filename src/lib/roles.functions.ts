/**
 * roles.functions.ts
 * Server functions for Boost!Roles module.
 * Covers: job descriptions, pay bands, career ladders, NAICS search, promotion readiness.
 *
 * Auth pattern: requireSupabaseAuth middleware → context.supabase + context.userId
 * Role checks: tenant_members table for membership; user_roles for platform roles
 * All writes gate on manager or admin role within tenant
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

async function requireTenantAccess(
  sb: any,
  userId: string,
  tenantId: string,
  allowedRoles: string[] = ["admin", "tenant_admin", "manager", "bsg_admin", "super_admin"],
) {
  const { data: platformRoles } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const pRoles = (platformRoles ?? []).map((r: any) => r.role as string);
  if (pRoles.includes("super_admin") || pRoles.includes("bsg_admin")) return;

  const { data: membership } = await sb
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  const mRoles = (membership ?? []).map((m: any) => m.role as string);
  if (mRoles.length === 0) throw new Error("Forbidden");
  const hasAllowed = mRoles.some((r) => allowedRoles.includes(r));
  if (!hasAllowed) throw new Error("Forbidden: insufficient role");
}

// ---------------------------------------------------------------------------
// Job Descriptions
// ---------------------------------------------------------------------------

export const listJobDescriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1), includeAll: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);

    // Check membership (any role)
    await requireTenantAccess(sb, context.userId, tenant.id, [
      "super_admin", "bsg_admin", "tenant_admin", "admin", "manager", "learner", "instructor", "mentor",
    ]);

    const { data: platformRoles } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const pRoles = (platformRoles ?? []).map((r: any) => r.role as string);
    const { data: membership } = await sb
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenant.id)
      .eq("user_id", context.userId);
    const mRoles = (membership ?? []).map((m: any) => m.role as string);
    const allRoles = [...pRoles, ...mRoles];

    const isPrivileged = allRoles.some((r) =>
      ["super_admin", "bsg_admin", "tenant_admin", "admin", "manager"].includes(r),
    );

    let query = sb
      .from("job_descriptions")
      .select("*, pay_band:pay_bands(title, level, min_salary, max_salary, currency)")
      .eq("tenant_id", tenant.id);

    if (!data.includeAll || !isPrivileged) {
      query = query.eq("status", "published");
    }

    const { data: jds, error } = await query.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return jds ?? [];
  });

export const publishJobDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ jd_id: z.string().uuid(), slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    await requireTenantAccess(sb, context.userId, tenant.id, [
      "super_admin", "bsg_admin", "tenant_admin", "admin", "manager",
    ]);

    const { error } = await sb
      .from("job_descriptions")
      .update({ status: "published" })
      .eq("id", data.jd_id)
      .eq("tenant_id", tenant.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ---------------------------------------------------------------------------
// Pay Bands
// ---------------------------------------------------------------------------

export const listPayBands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    await requireTenantAccess(sb, context.userId, tenant.id, [
      "super_admin", "bsg_admin", "tenant_admin", "admin", "manager",
    ]);

    const { data: bands, error } = await sb
      .from("pay_bands")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("level", { ascending: true });
    if (error) throw new Error(error.message);
    return bands ?? [];
  });

// ---------------------------------------------------------------------------
// Career Ladders
// ---------------------------------------------------------------------------

export const listCareerLadders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    await requireTenantAccess(sb, context.userId, tenant.id, [
      "super_admin", "bsg_admin", "tenant_admin", "admin", "manager", "learner", "instructor", "mentor",
    ]);

    const { data: ladders, error } = await sb
      .from("career_ladders")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("department", { ascending: true });
    if (error) throw new Error(error.message);
    return ladders ?? [];
  });

// ---------------------------------------------------------------------------
// NAICS Search
// ---------------------------------------------------------------------------

export const searchNaicsCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().min(2) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: codes, error } = await sb
      .from("naics_codes")
      .select("code, title, sector")
      .or(`title.ilike.%${data.q}%,sector.ilike.%${data.q}%`)
      .limit(20);
    if (error) throw new Error(error.message);
    return codes ?? [];
  });

// ---------------------------------------------------------------------------
// Promotion Readiness
// ---------------------------------------------------------------------------

export const getPromotionReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ slug: z.string().min(1), employee_id: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    await requireTenantAccess(sb, context.userId, tenant.id, [
      "super_admin", "bsg_admin", "tenant_admin", "admin", "manager",
    ]);

    let query = sb
      .from("promotion_readiness")
      .select("*")
      .eq("tenant_id", tenant.id);
    if (data.employee_id) query = query.eq("employee_id", data.employee_id);

    const { data: results, error } = await query.order("assessed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return results ?? [];
  });
