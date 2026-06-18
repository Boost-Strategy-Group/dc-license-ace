import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { CONTENT_AREAS } from "@/lib/exam";
import { GraduationCap, ShieldCheck, Sparkles, Timer } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Boost LCSW Readiness — Credential Prep for DC Apprentices" },
      { name: "description", content: "Boost Strategy Group's credential readiness tool for Washington DC LCSW apprentices: tagged ASWB question bank, timed mock exams, and a personal readiness score." },
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground font-display font-semibold">B</div>
            <div className="leading-tight">
              <div className="font-display text-lg font-semibold">Boost Readiness</div>
              <div className="text-xs text-muted-foreground">Boost Strategy Group · Washington DC</div>
            </div>
          </div>
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" /> Credential readiness for DC LCSW apprentices
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Walk into the ASWB Clinical exam<br/>
            <span className="text-accent">already feeling ready.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            A purpose-built prep platform for Boost Strategy Group apprentices preparing for licensure
            in Washington DC. Practice by content area, take full-length mocks, and track real readiness
            — all tied to the official ASWB blueprint.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth"><Button size="lg" className="bg-primary text-primary-foreground">Get started</Button></Link>
            <a href="#how"><Button size="lg" variant="outline">How it works</Button></a>
          </div>
        </section>

        <section id="how" className="border-t border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
            {[
              { icon: GraduationCap, title: "Tagged to the blueprint", body: "Every item is mapped to one of the four ASWB Clinical content areas, with sub-topic and difficulty." },
              { icon: Timer, title: "Full 170-question mock", body: "Timed 4-hour simulation mirroring the live exam, with content distribution drawn from the official blueprint." },
              { icon: ShieldCheck, title: "Readiness, not noise", body: "Personal dashboard surfaces weak areas, missed-item review, and a single readiness score." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-border bg-background p-6">
                <Icon className="h-6 w-6 text-accent" />
                <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-3xl font-semibold">The four ASWB Clinical content areas</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {CONTENT_AREAS.map((a) => (
              <div key={a.key} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-lg font-semibold">{a.label}</h3>
                  <span className="text-sm font-medium text-accent">{a.blueprintPct}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Boost Strategy Group. ASWB® is a registered trademark of the Association of Social Work Boards. This tool is not affiliated with or endorsed by ASWB.
        </div>
      </footer>
    </div>
  );
}
