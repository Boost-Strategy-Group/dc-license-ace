import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const confirmByToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ token: z.string().min(8) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("approval_requests")
      .select("id, tenant_id, kind, status")
      .eq("email_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Invalid or expired approval link");
    if (row.status === "confirmed") return { ok: true, status: "already", row };
    const { data: u } = await context.supabase.auth.getUser();
    const { error: upd } = await context.supabase
      .from("approval_requests")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by_email: u?.user?.email ?? null,
      })
      .eq("id", row.id);
    if (upd) throw new Error(upd.message);
    return { ok: true, status: "confirmed", row };
  });

export const Route = createFileRoute("/approvals/$token")({
  head: () => ({ meta: [{ title: "Confirm approval · BoostMyWorkforce" }] }),
  component: ApprovalConfirm,
});

function ApprovalConfirm() {
  const { token } = Route.useParams();
  const fn = useServerFn(confirmByToken);
  const nav = useNavigate();
  const [state, setState] = useState<"idle" | "loading" | "done" | "already" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function go() {
    setState("loading");
    try {
      const r = await fn({ data: { token } });
      setState(r.status === "already" ? "already" : "done");
      setMsg(`Approved: ${r.row.kind}`);
    } catch (e: any) {
      setState("error"); setMsg(e.message ?? "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-md py-20 px-4">
      <Card className="p-8 space-y-4">
        <h1 className="text-2xl font-semibold">Confirm and publish</h1>
        <p className="text-sm text-muted-foreground">
          You're signing off on a BoostMyWorkforce change. Click below to confirm — the change will go live immediately.
        </p>
        {state === "idle" && <Button onClick={go} className="w-full">Confirm and publish</Button>}
        {state === "loading" && <p className="text-sm">Working…</p>}
        {state === "done" && <p className="text-sm text-green-600">✓ {msg}. You can close this tab.</p>}
        {state === "already" && <p className="text-sm text-muted-foreground">Already confirmed — nothing to do.</p>}
        {state === "error" && <p className="text-sm text-destructive">{msg}</p>}
        <Button variant="ghost" className="w-full" onClick={() => nav({ to: "/launchpad" })}>Back to Launchpad</Button>
      </Card>
    </div>
  );
}
