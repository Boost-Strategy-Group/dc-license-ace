import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LaunchpadTile = {
  key: "roles" | "perform" | "pulse" | "learn";
  name: string;
  tagline: string;
  status: "active" | "coming_soon" | "available";
  href?: string;
};

export type LaunchpadData = {
  tenant: { id: string; name: string; logoUrl: string | null } | null;
  tiles: LaunchpadTile[];
};

const MODULE_HREF: Record<string, string> = {
  roles: "/modules/roles",
  perform: "/modules/perform",
  pulse: "/modules/pulse",
  learn: "/modules/learn",
};

export const getLaunchpad = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LaunchpadData> => {
    const { supabase, userId } = context;

    // Resolve tenant via tenant_members (pick first; multi-tenant switching is Phase 2)
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id, tenants(id, name, logo_url)")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const tenantRow = (membership?.tenants as { id: string; name: string; logo_url: string | null } | null) ?? null;

    // Load all 4 Boost! modules
    const { data: catalog, error: catErr } = await supabase
      .from("boost_modules")
      .select("id, key, name, tagline")
      .order("key");
    if (catErr) throw new Error(catErr.message);

    // Per-tenant entitlements
    let entitlements: Record<string, "active" | "coming_soon" | "available"> = {};
    if (tenantRow) {
      const { data: tbm } = await supabase
        .from("tenant_boost_modules")
        .select("status, boost_modules(key)")
        .eq("tenant_id", tenantRow.id);
      entitlements = Object.fromEntries(
        (tbm ?? []).map((row) => [
          (row.boost_modules as { key: string } | null)?.key ?? "",
          row.status as "active" | "coming_soon" | "available",
        ]),
      );
    }

    const tiles: LaunchpadTile[] = (catalog ?? []).map((m) => {
      const status = entitlements[m.key] ?? "available";
      const tile: LaunchpadTile = {
        key: m.key as LaunchpadTile["key"],
        name: m.name,
        tagline: m.tagline ?? "",
        status,
      };
      if (status === "active") tile.href = MODULE_HREF[m.key];
      return tile;
    });

    return {
      tenant: tenantRow
        ? { id: tenantRow.id, name: tenantRow.name, logoUrl: tenantRow.logo_asset_url }
        : null,
      tiles,
    };
  });
