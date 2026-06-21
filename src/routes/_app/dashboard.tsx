import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReadiness } from "@/lib/readiness.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CONTENT_AREAS, areaShort } from "@/lib/exam";
import { ArrowRight, BookOpen, Repeat2, Timer } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { GoSproutCard } from "@/components/GoSproutCard";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Boost LCSW Readiness" }, { name: "description", content: "Your personal LCSW readiness score, weak-area flags, and recent sessions." }] }),
  component: Dashboard,
});

function readinessQuery(fn: () => Promise<Awaited<ReturnType<typeof getReadiness>>>) {
  return queryOptions({ queryKey: ["readiness"], queryFn: fn });
}

function Dashboard() {
  const { user } = useAuth();
  const fn = useServerFn(getReadiness);
  const { data } = useSuspenseQuery(readinessQuery(() => fn()));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="font-display text-3xl font-semibold">{user?.user_metadata?.full_name ?? user?.email}</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Readiness</CardTitle></CardHeader>
          <CardContent>
            <div className="font-display text-5xl font-semibold text-primary">{data.overall}<span className="text-xl text-muted-foreground">%</span></div>
            <p className="mt-1 text-xs text-muted-foreground">Based on {data.total} answered question{data.total === 1 ? "" : "s"}</p>
            <Progress value={data.overall} className="mt-4" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Due for review</CardTitle></CardHeader>
          <CardContent>
            <div className="font-display text-5xl font-semibold">{data.dueCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">Missed items scheduled today</p>
            <Link to="/review"><Button variant="outline" className="mt-4 w-full gap-2">Start review <Repeat2 className="h-4 w-4" /></Button></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Quick start</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Link to="/practice"><Button className="w-full justify-between gap-2">Practice by area <BookOpen className="h-4 w-4" /></Button></Link>
            <Link to="/mock"><Button variant="outline" className="w-full justify-between gap-2">Take a full mock <Timer className="h-4 w-4" /></Button></Link>
          </CardContent>
        </Card>
      </div>

      <GoSproutCard />

      <Card>
        <CardHeader><CardTitle className="font-display">Performance by content area</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {data.byArea.map((a) => {
            const blueprint = CONTENT_AREAS.find((x) => x.key === a.area)?.blueprintPct ?? 0;
            return (
              <div key={a.area}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <div className="font-medium">{a.short}</div>
                  <div className="text-sm tabular-nums text-muted-foreground">
                    <span className="text-foreground">{a.accuracy ?? "—"}{a.accuracy != null ? "%" : ""}</span> · {a.attempted} attempted · {blueprint}% of exam
                  </div>
                </div>
                <Progress value={a.accuracy ?? 0} />
              </div>
            );
          })}
          {data.total === 0 && <p className="text-sm text-muted-foreground">Take your first practice set to see analytics here.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display">Recent sessions</CardTitle></CardHeader>
        <CardContent>
          {data.lastSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed sessions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.lastSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <div className="font-medium capitalize">{s.mode}{s.content_area ? ` · ${areaShort(s.content_area)}` : ""}</div>
                    <div className="text-xs text-muted-foreground">{new Date(s.started_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="tabular-nums text-sm"><span className="font-semibold">{s.correct_count}</span><span className="text-muted-foreground">/{s.total_questions}</span></div>
                    <Link to="/session/$id" params={{ id: s.id }}><Button size="sm" variant="ghost">Review <ArrowRight className="ml-1 h-3 w-3" /></Button></Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
