import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { issueCertifierForEnrollment } from "@/lib/integrations.functions";

async function handleCheckoutCompleted(session: Record<string, unknown>) {
  const metadata = (session.metadata as Record<string, string> | null) ?? {};
  const enrollmentId = metadata.enrollment_id || (session.client_reference_id as string | undefined);
  if (!enrollmentId) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("enrollments")
    .update({
      status: "active",
      payment_status: (session.payment_status as string | undefined) ?? "paid",
      stripe_session_id: (session.id as string | undefined) ?? null,
    })
    .eq("id", enrollmentId);

  // Fire-and-forget certifier issuance check (no-op unless the course is fully complete)
  try {
    await issueCertifierForEnrollment(supabaseAdmin as never, enrollmentId);
  } catch (e) {
    console.error("Certifier issuance after payment failed:", e);
  }
}

async function handleCheckoutFailed(session: Record<string, unknown>) {
  const metadata = (session.metadata as Record<string, string> | null) ?? {};
  const enrollmentId = metadata.enrollment_id || (session.client_reference_id as string | undefined);
  if (!enrollmentId) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("enrollments")
    .update({ payment_status: "failed", status: "pending_payment" })
    .eq("id", enrollmentId);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.type) {
            case "checkout.session.completed":
            case "transaction.completed":
              await handleCheckoutCompleted(event.data.object);
              break;
            case "checkout.session.expired":
            case "checkout.session.async_payment_failed":
            case "transaction.payment_failed":
              await handleCheckoutFailed(event.data.object);
              break;
            default:
              console.log("Unhandled payments event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Payments webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
