import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? "" }),
  head: () => ({ meta: [{ title: "Unsubscribe · BoostMyWorkforce" }] }),
  component: Unsubscribe,
});

function Unsubscribe() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const j = await r.json();
        if (!r.ok) setState("invalid");
        else if (j.valid) setState("valid");
        else setState("already");
      } catch { setState("error"); }
    })();
  }, [token]);

  async function confirm() {
    setBusy(true);
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json();
      setState(j.success ? "done" : "already");
    } catch { setState("error"); }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-md py-20 px-4">
      <Card className="p-8 space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Email preferences</h1>
        {state === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}
        {state === "valid" && (
          <>
            <p className="text-sm">Click below to unsubscribe from BoostMyWorkforce emails.</p>
            <Button onClick={confirm} disabled={busy}>{busy ? "Working…" : "Confirm unsubscribe"}</Button>
          </>
        )}
        {state === "already" && <p className="text-sm text-muted-foreground">You're already unsubscribed.</p>}
        {state === "done" && <p className="text-sm">You've been unsubscribed. Sorry to see you go.</p>}
        {state === "invalid" && <p className="text-sm text-destructive">This link is invalid or expired.</p>}
        {state === "error" && <p className="text-sm text-destructive">Something went wrong. Please try again later.</p>}
      </Card>
    </div>
  );
}
