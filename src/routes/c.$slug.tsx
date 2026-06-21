import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getTenantBySlug } from "@/lib/tenants.functions";
import { GraduationCap, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/c/$slug")({
  loader: async ({ params }) => {
    const tenant = await getTenantBySlug({ data: { slug: params.slug } });
    if (!tenant) throw notFound();
    return { tenant };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.tenant.name ?? "Client"} · Learning Portal` },
      {
        name: "description",
        content: `${loaderData?.tenant.name ?? ""} learning and credentialing portal, powered by Boost Strategy Group.`,
      },
      { property: "og:title", content: `${loaderData?.tenant.name ?? "Client"} Learning Portal` },
      { property: "og:description", content: "Branded learning, certification, and credentialing." },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center p-6 text-sm text-muted-foreground">
      Could not load portal: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h1 className="font-display text-3xl font-semibold">Portal not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">No client portal with that slug.</p>
        <Link to="/" className="mt-4 inline-block text-sm underline">Back to Boost</Link>
      </div>
    </div>
  ),
  component: ClientLanding,
});

function ClientLanding() {
  const { tenant } = Route.useLoaderData();
  const primary = tenant.brand_primary ?? "#0B2545";
  const secondary = tenant.brand_secondary ?? "#C9A227";

  return (
    <div
      className="min-h-screen"
      style={{ ["--brand-primary" as any]: primary, ["--brand-secondary" as any]: secondary }}
    >
      <header className="border-b border-border" style={{ backgroundColor: primary, color: "white" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="h-10 w-auto" />
            ) : (
              <div
                className="grid h-10 w-10 place-items-center rounded-md font-display text-lg font-semibold"
                style={{ backgroundColor: secondary, color: primary }}
              >
                {tenant.name.charAt(0)}
              </div>
            )}
            <div className="leading-tight">
              <div className="font-display text-lg font-semibold">{tenant.name}</div>
              <div className="text-xs opacity-75">Learning & Credentialing Portal</div>
            </div>
          </div>
          <Link to="/auth">
            <Button variant="secondary" style={{ backgroundColor: secondary, color: primary }}>
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <p
          className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{ backgroundColor: `${secondary}22`, color: primary }}
        >
          <Sparkles className="h-3 w-3" /> Powered by Boost Strategy Group
        </p>
        <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl" style={{ color: primary }}>
          {tenant.name}
          <br />
          <span style={{ color: secondary }}>Learning Portal</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          {tenant.welcome_copy ?? "Welcome to your team's learning, certification, and credentialing portal."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/auth">
            <Button size="lg" style={{ backgroundColor: primary, color: "white" }}>
              Sign in to your portal
            </Button>
          </Link>
        </div>

        <section className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            { icon: GraduationCap, title: "Self-paced & live courses", body: "Modular learning paths with quizzes, activities, and graded assessments." },
            { icon: ShieldCheck, title: "Verifiable credentials", body: "Stackable certificates and CEUs issued through Boost's Certifier integration." },
            { icon: Sparkles, title: "AI-assisted learning", body: "Personalized work products and study guides generated as you progress." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6">
              <Icon className="h-6 w-6" style={{ color: secondary }} />
              <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      {tenant.powered_by_boost_footer && (
        <footer className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-muted-foreground">
            Powered by{" "}
            <a href="/" className="font-semibold underline">
              Boost Strategy Group
            </a>{" "}
            · © {new Date().getFullYear()} {tenant.name}
          </div>
        </footer>
      )}
    </div>
  );
}
