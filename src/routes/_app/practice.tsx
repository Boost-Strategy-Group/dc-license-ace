import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startSession } from "@/lib/sessions.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CONTENT_AREAS, type ContentAreaKey } from "@/lib/exam";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/practice")({
  head: () => ({ meta: [{ title: "Practice · Boost LCSW Readiness" }] }),
  component: Practice,
});

function Practice() {
  const navigate = useNavigate();
  const start = useServerFn(startSession);
  const [area, setArea] = useState<ContentAreaKey | "all">("all");
  const [length, setLength] = useState(10);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const res = await start({ data: { mode: "practice", content_area: area === "all" ? undefined : area, length } });
      navigate({ to: "/session/$id", params: { id: res.sessionId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start session");
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Practice</h1>
        <p className="text-muted-foreground">Choose a content area and length. Instant feedback after every answer.</p>
      </header>

      <Card>
        <CardHeader><CardTitle className="font-display">Content area</CardTitle><CardDescription>Pick one or practice across the whole bank.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <AreaButton selected={area === "all"} onClick={() => setArea("all")} title="All areas" subtitle="Mixed practice" />
          {CONTENT_AREAS.map((a) => (
            <AreaButton key={a.key} selected={area === a.key} onClick={() => setArea(a.key)} title={a.short} subtitle={`${a.blueprintPct}% of exam`} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display">Length</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          {[5, 10, 25, 50].map((n) => (
            <Button key={n} variant={length === n ? "default" : "outline"} onClick={() => setLength(n)}>{n} questions</Button>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" disabled={busy} onClick={go}>{busy ? "Starting…" : "Begin practice"}</Button>
      </div>
    </div>
  );
}

function AreaButton({ selected, onClick, title, subtitle }: { selected: boolean; onClick: () => void; title: string; subtitle: string }) {
  return (
    <button onClick={onClick} className={`rounded-lg border p-4 text-left transition ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
      <div className="font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    </button>
  );
}
