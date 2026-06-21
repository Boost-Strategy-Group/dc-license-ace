import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GoSproutTenantConfig = {
  enabled: boolean;
  default_login_url: string;
  org_slug: string;
  instructions_md: string;
  integration_mode: "launchpad" | "api";
};

const DEFAULT_CFG: GoSproutTenantConfig = {
  enabled: false,
  default_login_url: "https://app.gosprout.io/",
  org_slug: "",
  instructions_md: "",
  integration_mode: "launchpad",
};

export type GoSproutLink = {
  id: string;
  user_id: string;
  tenant_id: string;
  gosprout_username: string | null;
  gosprout_program_url: string | null;
  status: "invited" | "active" | "inactive";
  last_launched_at: string | null;
  notes: string | null;
  full_name?: string | null;
};

// ---------- Tenant config (stored in tenants.settings.gosprout) ----------

export const getGoSproutConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: t, error } = await context.supabase
      .from("tenants").select("settings").eq("id", data.tenantId).maybeSingle();
    if (error) throw new Error(error.message);
    const cfg = ((t?.settings as any)?.gosprout ?? {}) as Partial<GoSproutTenantConfig>;
    return { ...DEFAULT_CFG, ...cfg } as GoSproutTenantConfig;
  });

const cfgInput = z.object({
  tenantId: z.string().uuid(),
  enabled: z.boolean(),
  default_login_url: z.string().url(),
  org_slug: z.string(),
  instructions_md: z.string(),
  integration_mode: z.enum(["launchpad", "api"]),
});

export const saveGoSproutConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => cfgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { tenantId, ...cfg } = data;
    const { data: t, error: e1 } = await context.supabase
      .from("tenants").select("settings").eq("id", tenantId).maybeSingle();
    if (e1) throw new Error(e1.message);
    const settings = { ...((t?.settings as any) ?? {}), gosprout: cfg };
    const { error } = await context.supabase
      .from("tenants").update({ settings }).eq("id", tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Roster ----------

export const listGoSproutLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ tenantId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("gosprout_links")
      .select("id, user_id, tenant_id, gosprout_username, gosprout_program_url, status, last_launched_at, notes, profiles:profiles(full_name)")
      .eq("tenant_id", data.tenantId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      full_name: r.profiles?.full_name ?? null,
    })) as GoSproutLink[];
  });

const upsertLinkInput = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  gosprout_username: z.string().nullable().optional(),
  gosprout_program_url: z.string().url().nullable().optional(),
  status: z.enum(["invited", "active", "inactive"]).optional(),
  notes: z.string().nullable().optional(),
});

export const upsertGoSproutLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertLinkInput.parse(i))
  .handler(async ({ data, context }) => {
    const { tenantId, userId, ...rest } = data;
    const { error } = await context.supabase
      .from("gosprout_links")
      .upsert(
        { tenant_id: tenantId, user_id: userId, ...rest },
        { onConflict: "user_id,tenant_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGoSproutLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("gosprout_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Learner-facing ----------

// Returns first active GoSprout context for the signed-in learner (across tenants).
export const getMyGoSprout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: links, error } = await context.supabase
      .from("gosprout_links")
      .select("id, tenant_id, gosprout_username, gosprout_program_url, status, last_launched_at, tenants:tenants(id, name, slug, settings)")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    const enabled = (links ?? []).find((l: any) => {
      const cfg = (l.tenants?.settings as any)?.gosprout as Partial<GoSproutTenantConfig> | undefined;
      return cfg?.enabled;
    }) as any;
    if (!enabled) return null;
    const cfg = { ...DEFAULT_CFG, ...((enabled.tenants?.settings as any)?.gosprout ?? {}) } as GoSproutTenantConfig;
    return {
      link_id: enabled.id as string,
      tenant: { id: enabled.tenants.id, name: enabled.tenants.name, slug: enabled.tenants.slug },
      launch_url: enabled.gosprout_program_url || cfg.default_login_url,
      username: enabled.gosprout_username as string | null,
      instructions_md: cfg.instructions_md,
      status: enabled.status as GoSproutLink["status"],
      last_launched_at: enabled.last_launched_at as string | null,
    };
  });

export const recordGoSproutLaunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ linkId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("gosprout_links")
      .update({ last_launched_at: new Date().toISOString(), status: "active" })
      .eq("id", data.linkId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
