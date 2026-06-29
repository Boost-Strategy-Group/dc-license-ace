/**
 * Tenant Dashboard — /_app/$slug/dashboard
 *
 * Role-differentiated landing page for each tenant workspace:
 *
 * super_admin / bsg_admin  → Platform overview: all 4 modules + tenant switcher
 * tenant_admin             → Org overview: headcounts, pulse snapshot, active reviews
 * manager                  → Team view: my direct reports, pending reviews, kudos
 * learner / instructor     → Personal view: enrolled courses, targets, pulse status
 *
 * Brand colors injected from tenant.brand_primary / brand_secondary via CSS vars.
 * Module cards only shown if the module is in tenant.modules_enabled.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTenant } from "@/contexts/tenant-context";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/$slug/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard · BOOST! My WorkForce Suite" }],
  }),
  component: TenantDashboard,
});

// ---------------------------------------------------------------------------
// Module definitions
// ---------------------------------------------------------------------------
const MODULES = [
  {
    id: "roles",
    label: "Boost!Roles",
    tagline: "Job architecture & career ladders",
    color: "var(--boost-roles)",      // oklch token from styles.css
    fallback: "#F7941D",
    href: (slug: string) => `/${slug}/roles` as const,
  },
  {
    id: "perform",
    label: "Boost!Perform",
    tagline: "Reviews, targets & coaching",
    color: "var(--boost-perform)",
    fallback: "#E8437A",
    href: (slug: string) => `/${slug}/perform` as const,
  },
  {
    id: "pulse",
    label: "Boost!Pulse",
    tagline: "Engagement & culture surveys",
    color: "var(--boost-pulse)",
    fallback: "#9B1FBF",
    href: (slug: string) => `/${slug}/pulse` as const,
  },
  {
    id: "learn",
    label: "Boost!Learn",
    tagline: "Courses, paths & certificates",
    color: "var(--boost-learn)",
    fallback: "#0F1F5C",
    href: (slug: string) => `/${slug}/learn` as const,
  },
] as const;

// ---------------------------------------------------------------------------
// Dashboard component
// ---------------------------------------------------------------------------
function TenantDashboard() {
  const { tenant, callerRole, isSuperAdmin, isBsgAdmin, isTenantAdmin, isManager, canAdminTenant } =
    useTenant();
  const { user } = useAuth();
  const { slug } = Route.useParams();

  const enabledModules = MODULES.filter(
    (m) =>
      !tenant.modules_enabled?.length ||
      tenant.modules_enabled.includes(m.id),
  );

  const brandPrimary = tenant.brand_primary ?? "oklch(0.27 0.06 255)";
  const brandSecondary = tenant.brand_secondary ?? "oklch(0.78 0.13 80)";

  const greeting = user?.user_metadata?.full_name ?? user?.email ?? "there";

  return (
    <div
      className="min-h-screen bg-background"
      style={
        {
          "--tenant-primary": brandPrimary,
          "--tenant-secondary": brandSecondary,
        } as React.CSSProperties
      }
    >
      {/* ── Header bar ── */}
      <div
        className="px-6 py-5 text-white"
        style={{ backgroundColor: "var(--tenant-primary)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="h-9 w-auto" />
            ) : (
              <div
                className="grid h-9 w-9 place-items-center rounded-md text-base font-semibold"
                style={{
                  backgroundColor: "var(--tenant-secondary)",
                  color: "var(--tenant-primary)",
                }}
              >
                {tenant.name.charAt(0)}
              </div>
            )}
            <div className="leading-tight">
              <div className="text-base font-semibold">{tenant.name}</div>
              <div className="text-xs opacity-70">BOOST! My WorkForce Suite</div>
            </div>
          </div>

          {/* Role badge */}
          <div
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{
              backgroundColor: `${brandSecondary}33`,
              color: "var(--tenant-secondary)",
            }}
          >
            {callerRole.replace("_", " ")}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        {/* Welcome */}
        <div>
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <h1 className="font-display text-3xl font-semibold">{greeting}</h1>
          {(isSuperAdmin || isBsgAdmin) && (
            <p className="mt-1 text-xs text-muted-foreground">
              You have platform-wide access. Viewing workspace:{" "}
              <span className="font-medium">{tenant.name}</span>
            </p>
          )}
        </div>

        {/* Admin quick-links (tenant_admin+ only) */}
        {canAdminTenant && (
          <div className="flex flex-wrap gap-2">
            <Link
              to="/_app/$slug/settings"
              params={{ slug }}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              Tenant Settings
            </Link>
            <Link
              to="/_app/$slug/team"
              params={{ slug }}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              Team Members
            </Link>
            {(isSuperAdmin || isBsgAdmin) && (
              <Link
                to="/admin/tenants"
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                All Tenants ↗
              </Link>
            )}
          </div>
        )}

        {/* Module cards */}
        <section>
          <h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Your Modules
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {enabledModules.map((mod) => (
              <ModuleCard
                key={mod.id}
                mod={mod}
                slug={slug}
                callerRole={callerRole}
              />
            ))}
          </div>
        </section>

        {/* Role-differentiated spotlight panels */}
        {(isTenantAdmin || isSuperAdmin || isBsgAdmin) && (
          <AdminSpotlight slug={slug} />
        )}
        {isManager && !canAdminTenant && <ManagerSpotlight slug={slug} />}
        {callerRole === "learner" && <LearnerSpotlight slug={slug} />}
      </main>

      {tenant.powered_by_boost_footer && (
        <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <a href="https://app.boostworkforce.com" className="font-semibold underline">
            BSG BOOST!
          </a>{" "}
          · Smart Tools. Stronger Teams. Better Results.
        </footer>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function ModuleCard({
  mod,
  slug,
  callerRole,
}: {
  mod: (typeof MODULES)[number];
  slug: string;
  callerRole: string;
}) {
  return (
    <Link
      to={mod.href(slug)}
      className="group block rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
    >
      {/* Color bar — uses oklch brand token, falls back to hex */}
      <div
        className="mb-4 h-1 w-10 rounded-full"
        style={{ backgroundColor: mod.color }}
      />
      <div className="font-semibold text-sm">{mod.label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{mod.tagline}</div>
      <div className="mt-4 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: mod.color }}>
        Open →
      </div>
    </Link>
  );
}

function AdminSpotlight({ slug }: { slug: string }) {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Active Reviews" value="—" href={`/${slug}/perform`} />
      <StatCard label="Pulse Response Rate" value="—" href={`/${slug}/pulse`} />
      <StatCard label="Course Completions" value="—" href={`/${slug}/learn`} />
    </section>
  );
}

function ManagerSpotlight({ slug }: { slug: string }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <StatCard label="My Team — Pending Reviews" value="—" href={`/${slug}/perform`} />
      <StatCard label="Kudos Sent This Month" value="—" href={`/${slug}/perform`} />
    </section>
  );
}

function LearnerSpotlight({ slug }: { slug: string }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <StatCard label="Courses In Progress" value="—" href={`/${slug}/learn`} />
      <StatCard label="My Targets" value="—" href={`/${slug}/perform`} />
    </section>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow"
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl font-semibold text-foreground">
        {value}
      </div>
    </a>
  );
}
