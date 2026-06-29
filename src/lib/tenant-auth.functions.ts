/**
 * tenant-auth.functions.ts
 * Server functions for resolving a caller's tenant context by slug.
 * Used by the $slug layout loader to gate entry and inject role.
 *
 * Rules:
 * - super_admin: access to ALL tenants, always resolves
 * - bsg_admin: access to ALL tenants (cross-tenant BSG staff)
 * - tenant_admin / manager / learner / instructor / mentor: must be a tenant_member
 * - Not a member → throws Forbidden (loader redirects to /dashboard)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TenantContext = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    kind: string;
    logo_url: string | null;
    brand_primary: string | null;
    brand_secondary: string | null;
    welcome_copy: string | null;
    powered_by_boost_footer: boolean;
    custom_domain: string | null;
    modules_enabled: string[];
  };
  callerRole:
    | "super_admin"
    | "bsg_admin"
    | "tenant_admin"
    | "manager"
    | "learner"
    | "instructor"
    | "mentor";
};

const ROLE_PRIORITY: Record<string, number> = {
  super_admin: 100,
  bsg_admin: 90,
  tenant_admin: 80,
  manager: 60,
  instructor: 50,
  mentor: 40,
  learner: 10,
  student: 5,
};

function highestRole(roles: string[]): TenantContext["callerRole"] {
  return (
    roles.reduce(
      (best, r) => (ROLE_PRIORITY[r] ?? 0) > (ROLE_PRIORITY[best] ?? 0) ? r : best,
      "learner",
    ) as TenantContext["callerRole"]
  );
}

/**
 * getMyTenantContext
 * Resolves tenant by slug and determines caller's role within it.
 * Throws "Forbidden" if caller is not a member and not a platform admin.
 */
export const getMyTenantContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<TenantContext> => {
    const sb = context.supabase;
    const userId = context.userId;

    // 1. Resolve tenant
    const { data: tenant, error: tErr } = await sb
      .from("tenants")
      .select(
        "id, slug, name, kind, logo_url, brand_primary, brand_secondary, welcome_copy, powered_by_boost_footer, custom_domain, modules_enabled",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tenant) throw new Error("NotFound");

    // 2. Get caller's platform-level roles
    const { data: platformRoles } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allRoles = (platformRoles ?? []).map((r: any) => r.role as string);

    const isSuperAdmin = allRoles.includes("super_admin");
    const isBsgAdmin = allRoles.includes("bsg_admin");

    // 3. Platform admins always get access
    if (isSuperAdmin) {
      return {
        tenant: tenant as TenantContext["tenant"],
        callerRole: "super_admin",
      };
    }
    if (isBsgAdmin) {
      return {
        tenant: tenant as TenantContext["tenant"],
        callerRole: "bsg_admin",
      };
    }

    // 4. Check tenant membership
    const { data: membership } = await sb
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenant.id)
      .eq("user_id", userId);

    const memberRoles = (membership ?? []).map((m: any) => m.role as string);
    if (memberRoles.length === 0) throw new Error("Forbidden");

    return {
      tenant: tenant as TenantContext["tenant"],
      callerRole: highestRole(memberRoles),
    };
  });

/**
 * getMyTenants
 * Lists all tenants the caller has access to (for the tenant picker / redirect).
 * super_admin and bsg_admin see all tenants.
 * Others see only their tenant memberships.
 */
export const getMyTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const userId = context.userId;

    const { data: platformRoles } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allRoles = (platformRoles ?? []).map((r: any) => r.role as string);
    const isSuperAdmin = allRoles.includes("super_admin");
    const isBsgAdmin = allRoles.includes("bsg_admin");

    if (isSuperAdmin || isBsgAdmin) {
      const { data: tenants, error } = await sb
        .from("tenants")
        .select(
          "id, slug, name, kind, logo_url, brand_primary, modules_enabled",
        )
        .order("name");
      if (error) throw new Error(error.message);
      return (tenants ?? []) as TenantContext["tenant"][];
    }

    // Regular members — only their tenants
    const { data: memberships, error } = await sb
      .from("tenant_members")
      .select(
        "tenant:tenants(id, slug, name, kind, logo_url, brand_primary, modules_enabled)",
      )
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (memberships ?? [])
      .map((m: any) => m.tenant)
      .filter(Boolean) as TenantContext["tenant"][];
  });
