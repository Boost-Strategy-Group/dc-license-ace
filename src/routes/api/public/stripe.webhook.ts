import { createFileRoute } from "@tanstack/react-router";
import { issueCertifierForEnrollment } from "@/lib/integrations.functions";

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        const sig = request.headers.get("stripe-signature");
        const raw = await request.text();
        if (!secret || !sig) return new Response("Webhook not configured", { status: 400 });

        // Verify signature (Stripe v1 scheme)
        const { createHmac, timingSafeEqual } = await import("crypto");
        const parts = Object.fromEntries(sig.split(",").map((p) => p.split("=") as [string, string]));
        const timestamp = parts["t"];
        const v1 = parts["v1"];
        if (!timestamp || !v1) return new Response("Bad signature", { status: 400 });
        const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
        try {
          if (!timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) {
            return new Response("Invalid signature", { status: 401 });
          }
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(raw) as { type: string; data: { object: Record<string, unknown> } };

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as { id?: string; client_reference_id?: string; metadata?: Record<string, string>; payment_status?: string };
          const enrollmentId = session.metadata?.enrollment_id || session.client_reference_id;
          if (enrollmentId) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin
              .from("enrollments")
              .update({
                status: "active",
                payment_status: session.payment_status ?? "paid",
                stripe_session_id: session.id ?? null,
              })
              .eq("id", enrollmentId);
          }
        }

        if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
          const session = event.data.object as { metadata?: Record<string, string>; client_reference_id?: string };
          const enrollmentId = session.metadata?.enrollment_id || session.client_reference_id;
          if (enrollmentId) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin
              .from("enrollments")
              .update({ payment_status: "failed", status: "pending_payment" })
              .eq("id", enrollmentId);
          }
        }

        // Future: subscription/invoice events when we add recurring tenant billing.
        void issueCertifierForEnrollment; // referenced to keep import for completion path
        return new Response("ok");
      },
    },
  },
});
