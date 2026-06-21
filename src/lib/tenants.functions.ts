import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type TenantRow = {
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
};

const tenantCols =
  "id, slug, name, kind, logo_url, brand_primary, brand_secondary, welcome_copy, powered_by_boost_footer, custom_domain";

// PUBLIC: white-label landing (anon)
export const getTenantBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const supabasePublic = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: tenant, error } = await supabasePublic
      .from("tenants")
      .select(tenantCols)
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return tenant as TenantRow | null;
  });

// AUTHED: my tenant memberships
export const listMyMemberships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tenant_members")
      .select(`role, tenant:tenants(${tenantCols})`)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({ role: r.role as string, tenant: r.tenant as TenantRow }));
  });

// AUTHED: list all tenants (super_admin or member)
export const listTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tenants")
      .select(tenantCols)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as TenantRow[];
  });

const upsertTenantInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "lowercase, numbers and dashes only"),
  name: z.string().min(1),
  kind: z.enum(["root", "apprenticeship", "client"]).default("client"),
  logo_url: z.string().url().nullable().optional(),
  brand_primary: z.string().nullable().optional(),
  brand_secondary: z.string().nullable().optional(),
  welcome_copy: z.string().nullable().optional(),
  powered_by_boost_footer: z.boolean().optional(),
});

export const upsertTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertTenantInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tenants")
      .upsert(data, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Tenant members
export const listTenantMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: members, error } = await context.supabase
      .from("tenant_members")
      .select("id, user_id, role, created_at, profiles:profiles(full_name)")
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);
    return (members ?? []).map((m: any) => ({
      id: m.id as string,
      user_id: m.user_id as string,
      role: m.role as string,
      created_at: m.created_at as string,
      full_name: (m.profiles?.full_name as string | null) ?? null,
    }));
  });

const inviteInput = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["tenant_admin", "instructor", "learner", "mentor"]),
});

// Add an existing user to a tenant, or invite them by email if they don't exist yet.
export const inviteToTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteInput.parse(input))
  .handler(async ({ data, context }) => {
    // Authorize: caller must be super_admin or tenant_admin of this tenant
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    const { data: isTenantAdmin } = await context.supabase.rpc("has_tenant_role", {
      _tenant_id: data.tenantId,
      _user_id: context.userId,
      _role: "tenant_admin",
    });
    if (!isSuper && !isTenantAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find or invite the user
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("full_name", data.email)
      .maybeSingle();

    let userId = existing?.id as string | undefined;
    if (!userId) {
      // Search auth.users by email via admin API
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listErr) throw new Error(listErr.message);
      userId = list.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase())?.id;

      if (!userId) {
        const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
        if (invErr) throw new Error(invErr.message);
        userId = invited.user?.id;
      }
    }
    if (!userId) throw new Error("Could not resolve user");

    const { error: insErr } = await supabaseAdmin
      .from("tenant_members")
      .upsert(
        { tenant_id: data.tenantId, user_id: userId, role: data.role },
        { onConflict: "tenant_id,user_id,role" },
      );
    if (insErr) throw new Error(insErr.message);
    return { ok: true, userId };
  });

export const removeTenantMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ memberId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tenant_members")
      .delete()
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkSuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    return { isSuperAdmin: !!data };
  });
