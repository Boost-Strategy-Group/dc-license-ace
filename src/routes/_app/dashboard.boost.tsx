/**
 * BOOST! Tenant Selector — /_app/dashboard/boost (or /_app/boost-home)
 *
 * Landing screen for authenticated users that:
 *   1. Have exactly 1 tenant → auto-redirect to /{slug}/dashboard
 *   2. Have multiple tenants → show picker
 *   3. Are super_admin / bsg_admin → show all tenants + platform controls
 *
 * This supplements (does not replace) the existing /_app/dashboard route
 * which serves the LCSW readiness product.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getMyTenants } from "@/lib/tenant-auth.functions";
import { useAuth } from "@/hooks/use-auth";
import type { TenantContext } from "@/lib/tenant-auth.functions";

export const Route = createFileRoute("/_app/dashboard/boost")({
  head: () => ({
    meta: [{ title: "My Workspaces · BOOST!" }],
  }),
  component: BoostHome,
});

function tenantsQuery(fn: () => Promise<TenantContext["tenant"][]>) {
  return queryOptions({
    queryKey: ["my-tenants"],
    queryFn: fn,
    staleTime: 60_000,
  });
}

function BoostHome() {
  const { isSuperAdmin, isBsgAdmin } = useAuth();
  const fn = useServerFn(getMyTenants);
  const navigate = useNavigate();

  const { data: tenants } = useSuspenseQuery(tenantsQuery(() => fn()));

  // Single-tenant users: redirect immediately
  useEffect(() => {
    if (!isSuperAdmin && !isBsgAdmin && tenants.length === 1) {
      navigate({
        to: "/_app/$slug/dashboard",
        params: { slug: tenants[0].slug },
        replace: true,
      });
    }
  }, [tenants, isSuperAdmin, isBsgAdmin, navigate]);

  const isPlatformAdmin = isSuperAdmin || isBsgAdmin;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <header>
        <h1 className="font-display text-3xl font-semibold">
          {isPlatformAdmin ? "All Workspaces" : "My Workspaces"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isPlatformAdmin
            ? "You have platform-wide access. Select a client workspace to manage."
            : "Select your workspace to get started."}
        </p>
      </header>

      {tenants.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          You don't have access to any workspaces yet. Contact your BSG admin.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <TenantCard key={tenant.id} tenant={tenant} />
          ))}
        </div>
      )}

      {isPlatformAdmin && (
        <div className="flex gap-3">
          <Link
            to="/admin/tenants"
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Manage Tenants
          </Link>
          <Link
            to="/admin/student-management"
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            All Members
          </Link>
        </div>
      )}
    </div>
  );
}

function TenantCard({ tenant }: { tenant: TenantContext["tenant"] }) {
  const primary = tenant.brand_primary ?? "oklch(0.27 0.06 255)";
  const enabledCount = tenant.modules_enabled?.length ?? 4;

  return (
    <Link
      to="/_app/$slug/dashboard"
      params={{ slug: tenant.slug }}
      className="group block rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-3 mb-4">
        {tenant.logo_url ? (
          <img src={tenant.logo_url} alt={tenant.name} className="h-8 w-auto" />
        ) : (
          <div
            className="grid h-8 w-8 place-items-center rounded-md text-sm font-semibold text-white"
            style={{ backgroundColor: primary }}
          >
            {tenant.name.charAt(0)}
          </div>
        )}
        <div className="font-semibold text-sm leading-tight">{tenant.name}</div>
      </div>
      <div className="text-xs text-muted-foreground">
        {enabledCount} module{enabledCount !== 1 ? "s" : ""} active
      </div>
      <div className="mt-3 text-xs font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        Open workspace →
      </div>
    </Link>
  );
}
