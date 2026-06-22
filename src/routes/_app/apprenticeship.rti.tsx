import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRti } from "@/lib/rti.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_app/apprenticeship/rti")({
  head: () => ({ meta: [{ title: "My RTI Hours · BoostMyWorkforce" }] }),
  component: MyRtiPage,
});

function MyRtiPage() {
  const fn = useServerFn(getMyRti);
  const { data, isLoading } = useQuery({ queryKey: ["my-rti"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <GraduationCap className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-semibold">My RTI Hours</h1>
          <p className="text-sm text-muted-foreground">
            Related Technical Instruction progress toward your apprenticeship.
          </p>
        </div>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && (!data || data.length === 0) && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You aren't enrolled in an apprenticeship program yet. Reach out to your program admin.
          </CardContent>
        </Card>
      )}

      {(data ?? []).map((rec) => {
        const pct = rec.required_hours
          ? Math.min(100, Math.round((rec.completed_hours / rec.required_hours) * 100))
          : 0;
        return (
          <Card key={rec.learner_id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {rec.program?.name ?? "Apprenticeship"}
                </CardTitle>
                <Badge variant="secondary">
                  {rec.completed_hours} / {rec.required_hours} hrs
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={pct} />
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Completion history
                </div>
                {rec.completions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No RTI completions logged yet.</p>
                )}
                <ul className="divide-y rounded-md border">
                  {rec.completions.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">{c.course_title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(c.completed_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant="outline">{c.rti_hours} hrs</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
