import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FEATURE = "conversation_coach";

const Input = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  employee_name: z.string().min(1),
  review_period: z.string().min(1),
  targets: z.array(z.object({ title: z.string(), progress: z.number() })).default([]),
  recent_kudos: z.array(z.string()).default([]),
  manager_notes: z.string().default(""),
});

export type CoachAgenda = {
  agenda: string;
  talking_points: string[];
  suggested_questions: string[];
};

// Conversation Coach (Boost!Perform) — manager-only.
// Generates a draft 1:1 agenda. Result is staged only, never auto-applied.
export const generateCoachAgenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { createOpenAIClient, chatJson, logAiUsage, MODELS, untyped } =
      await import("./openai.server");

    // Manager-only gate: caller must hold a manager-level role on this tenant.
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    let allowed = Boolean(isSuper);
    if (!allowed) {
      for (const role of ["admin", "tenant_admin"] as const) {
        const { data: ok } = await context.supabase.rpc("has_tenant_role", {
          _tenant_id: data.tenant_id,
          _user_id: context.userId,
          _role: role,
        });
        if (ok) {
          allowed = true;
          break;
        }
      }
    }
    if (!allowed) throw new Error("Forbidden: Conversation Coach is manager-only.");

    // Tenant feature flag must be enabled.
    const { data: tenant, error: tErr } = await untyped(context.supabase)
      .from("tenants")
      .select("conversation_coach_enabled")
      .eq("id", data.tenant_id)
      .single();
    if (tErr) throw new Error(tErr.message);
    if (!tenant?.conversation_coach_enabled) {
      throw new Error("Conversation Coach is not enabled for this tenant.");
    }

    const system =
      "You are an executive coach helping a manager prepare for a 1:1 performance conversation. Generate a structured agenda with talking points that are strength-based, forward-looking, and psychologically safe.";
    const user = `Prepare a 1:1 conversation agenda.

Employee: ${data.employee_name}
Review period: ${data.review_period}
Targets:
${data.targets.map((t) => `- ${t.title} (progress: ${t.progress}%)`).join("\n") || "- (none recorded)"}
Recent kudos:
${data.recent_kudos.map((k) => `- ${k}`).join("\n") || "- (none)"}
Manager notes: ${data.manager_notes || "(none)"}

Return JSON:
{
  "agenda": "string — a short structured agenda outline",
  "talking_points": ["string", ...],
  "suggested_questions": ["string", ...]
}`;

    const { data: output, usage } = await chatJson<CoachAgenda>({
      client: createOpenAIClient(),
      model: MODELS.FULL,
      system,
      user,
    });

    await logAiUsage({
      tenant_id: data.tenant_id,
      user_id: context.userId,
      feature: FEATURE,
      model: MODELS.FULL,
      usage,
      metadata: {
        tenant_id: data.tenant_id,
        user_id: context.userId,
        feature: FEATURE,
        employee_name: data.employee_name,
      },
    });

    // Stage the draft session (manager_id = caller). Not auto-applied.
    let sessionId: string | null = null;
    const { data: session, error: sErr } = await untyped(context.supabase)
      .from("conversation_coach_sessions")
      .insert({
        tenant_id: data.tenant_id,
        manager_id: context.userId,
        employee_id: data.user_id,
        session_date: new Date().toISOString(),
        agenda_json: output,
        notes_text: data.manager_notes,
        follow_up_items: [],
        is_completed: false,
      })
      .select("id")
      .single();
    if (sErr) console.error("[conversation_coach_sessions] insert failed", sErr.message);
    else sessionId = session?.id ?? null;

    return { sessionId, draft: output };
  });
