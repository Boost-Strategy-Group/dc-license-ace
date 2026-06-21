import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIntegrationStatus } from "@/lib/integrations.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Plug } from "lucide-react";

export const Route = createFileRoute("/_app/admin/integrations")({
  head: () => ({ meta: [{ title: "Integrations · Boost Admin" }] }),
  component: IntegrationsPage,
});

const PROVIDERS = [
  { key: "stripe" as const, name: "Stripe", desc: "Paid course enrollment via Checkout.", secrets: ["STRIPE_SECRET_KEY"] },
  { key: "stripeWebhook" as const, name: "Stripe webhook", desc: "Signs incoming Stripe events at /api/public/stripe/webhook.", secrets: ["STRIPE_WEBHOOK_SECRET"] },
  { key: "heygen" as const, name: "HeyGen", desc: "AI avatar narration for HeyGen lessons.", secrets: ["HEYGEN_API_KEY", "HEYGEN_DEFAULT_AVATAR_ID (optional)", "HEYGEN_DEFAULT_VOICE_ID (optional)"] },
  { key: "zoom" as const, name: "Zoom Web SDK", desc: "Embedded live sessions inside the player.", secrets: ["ZOOM_SDK_KEY", "ZOOM_SDK_SECRET", "ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET (to create meetings)"] },
  { key: "certifier" as const, name: "Certifier", desc: "Issues credentials automatically on course completion.", secrets: ["CERTIFIER_API_KEY"] },
  { key: "talentlms" as const, name: "TalentLMS", desc: "SSO-launched courses embedded in Boost.", secrets: ["TALENTLMS_API_KEY", "TALENTLMS_DOMAIN"] },
];

function IntegrationsPage() {
  const fn = useServerFn(getIntegrationStatus);
  const { data: status } = useQuery({ queryKey: ["integrations"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2"><Plug className="h-7 w-7 text-primary" /> Integrations</h1>
        <p className="text-sm text-muted-foreground">Provider connections that power the BOOST platform. Add the listed secrets to enable each one.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PROVIDERS.map((p) => {
          const ok = status?.[p.key];
          return (
            <Card key={p.key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <Badge variant={ok ? "default" : "outline"} className="gap-1">
                    {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {ok ? "Connected" : "Not configured"}
                  </Badge>
                </div>
                <CardDescription>{p.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">Required secrets:</div>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {p.secrets.map((s) => <li key={s}><code>{s}</code></li>)}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Stripe webhook setup</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Point your Stripe webhook at:</p>
          <code className="block rounded bg-muted px-3 py-2 text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/api/public/stripe/webhook</code>
          <p>Subscribe to <code>checkout.session.completed</code>, <code>checkout.session.expired</code>, and <code>checkout.session.async_payment_failed</code>. Copy the signing secret into <code>STRIPE_WEBHOOK_SECRET</code>.</p>
        </CardContent>
      </Card>
    </div>
  );
}
