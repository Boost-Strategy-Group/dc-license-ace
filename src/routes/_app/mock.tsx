import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startSession } from "@/lib/sessions.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_MINUTES, MOCK_TOTAL, CONTENT_AREAS } from "@/lib/exam";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/mock")({
  head: () => ({ meta: [{ title: "Mock exam · Boost LCSW Readiness" }] }),
  component: Mock,
});

function Mock() {
  const navigate = useNavigate();
  const start = useServerFn(startSession);
  const [busy, setBusy] = useState(false);

  async function go(length: number) {
    setBusy(true);
    try {
      const res = await start({ data: { mode: "mock", length } });
      navigate({ to: "/session/$id", params: { id: res.sessionId }, search: { mock: 1 } as never });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Full-length mock exam</h1>
        <p className="text-muted-foreground">{MOCK_TOTAL} questions · {MOCK_MINUTES / 60} hours · blueprint-weighted across all four areas.</p>
      </header>
      <Card>
        <CardHeader><CardTitle className="font-display">Exam blueprint</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {CONTENT_AREAS.map((a) => (
              <li key={a.key} className="flex justify-between"><span>{a.label}</span><span className="tabular-nums text-muted-foreground">{a.blueprintPct}%</span></li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" disabled={busy} onClick={() => go(MOCK_TOTAL)}>Start full {MOCK_TOTAL}-question mock</Button>
        <Button size="lg" variant="outline" disabled={busy} onClick={() => go(50)}>Half-length warmup (50 Qs)</Button>
      </div>
      <p className="text-xs text-muted-foreground">Tip: take the full mock in a single quiet sitting to most accurately predict your real-day stamina.</p>
    </div>
  );
}
