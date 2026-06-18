import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startSession } from "@/lib/sessions.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/review")({
  head: () => ({ meta: [{ title: "Review queue · Boost LCSW Readiness" }] }),
  component: Review,
});

function Review() {
  const navigate = useNavigate();
  const start = useServerFn(startSession);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const res = await start({ data: { mode: "review" } });
      navigate({ to: "/session/$id", params: { id: res.sessionId } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Review queue</h1>
        <p className="text-muted-foreground">Spaced repetition of items you've missed — they come back due on a schedule that lengthens each time you get them right.</p>
      </header>
      <Card>
        <CardHeader><CardTitle className="font-display">Today's review</CardTitle><CardDescription>Up to 50 due items per session.</CardDescription></CardHeader>
        <CardContent>
          <Button size="lg" disabled={busy} onClick={go}>{busy ? "Loading…" : "Start review"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
