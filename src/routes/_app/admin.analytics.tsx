import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { cohortAnalytics } from "@/lib/admin-stats.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_app/admin/analytics")({
  head: () => ({ meta: [{ title: "Analytics · Admin" }] }),
  component: Analytics,
});

function Analytics() {
  const fn = useServerFn(cohortAnalytics);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "analytics"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Cohort analytics</h1>
        <p className="text-muted-foreground">Aggregate view of how apprentices are performing across the question bank.</p>
      </header>

      {isLoading || !data ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Students</CardTitle></CardHeader><CardContent><div className="font-display text-4xl font-semibold">{data.students}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Published questions</CardTitle></CardHeader><CardContent><div className="font-display text-4xl font-semibold">{data.questions}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="font-display">Accuracy by content area</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {data.byArea.map((a) => (
                <div key={a.area}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">{a.short}</span>
                    <span className="tabular-nums text-muted-foreground">{a.accuracy ?? "—"}{a.accuracy != null ? "%" : ""} · {a.attempted} answered</span>
                  </div>
                  <Progress value={a.accuracy ?? 0} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-display">Hardest questions</CardTitle></CardHeader>
            <CardContent>
              {data.hardest.length === 0 ? <p className="text-sm text-muted-foreground">Not enough data yet.</p> : (
                <ul className="divide-y divide-border">
                  {data.hardest.map((q) => (
                    <li key={q.id} className="flex items-start justify-between gap-4 py-3">
                      <p className="line-clamp-2 text-sm">{q.stem}</p>
                      <div className="shrink-0 text-right text-sm">
                        <div className="font-semibold text-destructive">{q.accuracy}%</div>
                        <div className="text-xs text-muted-foreground">{q.total} attempts</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
