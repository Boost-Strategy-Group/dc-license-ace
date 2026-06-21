import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { listTenants } from "@/lib/tenants.functions";
import { Award, Building2, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BOOST Learning & Credentialing Platform" },
      {
        name: "description",
        content:
          "AI-powered learning, certification, credentialing, and apprenticeship platform by Boost Strategy Group. Multi-tenant, IACET-aligned, with embedded video, live sessions, and AI course factory.",
      },
      { property: "og:title", content: "BOOST Learning & Credentialing Platform" },
      {
        property: "og:description",
        content: "Build, deliver, and credential learning experiences with AI assistance.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  const listFn = useServerFn(listTenants);
  // anonymous read works via the public-landing SELECT policy on tenants
  const { data: tenants } = useQuery({
    queryKey: ["public-tenants"],
    queryFn: () => listFn().catch(() => []),
    enabled: true,
  });
  const clientTenants = (tenants ?? []).filter((t) => t.kind === "client");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground font-display font-semibold">
              B
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-semibold">BOOST</div>
              <div className="text-xs text-muted-foreground">Learning & Credentialing Platform</div>
            </div>
          </div>
          <Link to="/auth">
            <Button variant="ghost">Sign in</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" /> AI-powered. IACET-aligned. Built by Boost Strategy Group.
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Build, deliver, and credential
            <br />
            <span className="text-accent">learning that gets people hired.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            A multi-tenant learning ecosystem for client academies, apprenticeship programs, and workforce
            partners. Self-paced, hybrid, and live-instructor-led courses — all from one platform, all in
            your brand.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-primary text-primary-foreground">Get started</Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="outline">How it works</Button>
            </a>
          </div>
        </section>

        <section id="how" className="border-t border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
            {[
              { icon: GraduationCap, title: "AI Course Factory", body: "Generate IACET-aligned needs assessments, objectives, modules, quizzes, and activities — then refine in the visual Course Builder." },
              { icon: Building2, title: "Multi-tenant & white-label", body: "Stand up a branded portal for every client, ambassador, or apprenticeship program in minutes." },
              { icon: Award, title: "Stackable credentials", body: "CEUs, course certificates, and stackable credentials issued through Certifier with verifiable badges." },
              { icon: ShieldCheck, title: "Embedded live & video", body: "Zoom live sessions, HeyGen narrated lessons, and TalentLMS content — all inside one player. No leaving the platform." },
              { icon: Sparkles, title: "AI work products", body: "Activities feed deliverables: business plans, SOPs, capability statements, and strategic plans — straight into the Student Vault." },
              { icon: GraduationCap, title: "Apprenticeship-ready", body: "Mentors, RTI, competencies, and funding-source tagging built into the foundation. LCSW DC apprentices live here today." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-border bg-background p-6">
                <Icon className="h-6 w-6 text-accent" />
                <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {clientTenants.length > 0 && (
          <section className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="font-display text-3xl font-semibold">Client portals</h2>
            <p className="mt-2 text-sm text-muted-foreground">Branded learning experiences powered by Boost.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {clientTenants.map((t) => (
                <a key={t.id} href={`/c/${t.slug}`} className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-accent">
                  <div className="flex items-center gap-3">
                    <div
                      className="grid h-10 w-10 place-items-center rounded-md font-display text-lg font-semibold text-white"
                      style={{ backgroundColor: t.brand_primary ?? "#0B2545" }}
                    >
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-display font-semibold">{t.name}</div>
                      <div className="text-xs text-muted-foreground">/c/{t.slug}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Boost Strategy Group. IACET accredited provider. ASWB® is a registered
          trademark of the Association of Social Work Boards.
        </div>
      </footer>
    </div>
  );
}
