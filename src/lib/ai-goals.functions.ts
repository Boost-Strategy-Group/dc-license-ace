import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FEATURE = "goal_coach";

const Input = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  job_title: z.string().min(1),
  department: z.string().default(""),
  current_targets: z.array(z.string()).default([]),
  company_priorities: z.string().default(""),
});

export type TargetSuggestion = {
  title: string;
  description: string;
  success_metric: string;
  timeline: string;
};

// Employee Goal Coach (Boost!Perform, beta) — double opt-in gate:
// tenant flag goal_coach_enabled AND learner flag goal_coach_opted_in.
// Suggestions are drafts; the employee must accept before any target is created.
export const generateTargetSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { createOpenAIClient, chatJson, logAiUsage, MODELS, untyped } =
      await import("./openai.server");

    const { data: tenant, error: tErr } = await untyped(context.supabase)
      .from("tenants")
      .select("goal_coach_enabled")
      .eq("id", data.tenant_id)
      .single();
    if (tErr) throw new Error(tErr.message);
    if (!tenant?.goal_coach_enabled) {
      throw new Error("Goal Coach is not enabled for this tenant.");
    }

    const { data: learner, error: lErr } = await untyped(context.supabase)
      .from("learners")
      .select("goal_coach_opted_in")
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", data.employee_id)
      .single();
    if (lErr) throw new Error(lErr.message);
    if (!learner?.goal_coach_opted_in) {
      throw new Error("Employee has not opted in to Goal Coach.");
    }

    const system =
      "You are a career development coach. Suggest 3-5 SMART performance targets aligned to the employee's role and company priorities. Each target should be specific, measurable, achievable, relevant, and time-bound.";
    const user = `Suggest SMART performance targets.

Job title: ${data.job_title}
Department: ${data.department || "(unspecified)"}
Current targets:
${data.current_targets.map((t) => `- ${t}`).join("\n") || "- (none)"}
Company priorities: ${data.company_priorities || "(unspecified)"}

Return JSON:
{
  "suggestions": [
    { "title": "string", "description": "string", "success_metric": "string", "timeline": "string" }
  ]
}`;

    const { data: output, usage } = await chatJson<{ suggestions: TargetSuggestion[] }>({
      client: createOpenAIClient(),
      model: MODELS.MINI,
      system,
      user,
    });

    await logAiUsage({
      tenant_id: data.tenant_id,
      user_id: context.userId,
      feature: FEATURE,
      model: MODELS.MINI,
      usage,
      metadata: {
        tenant_id: data.tenant_id,
        user_id: context.userId,
        feature: FEATURE,
        employee_id: data.employee_id,
      },
    });

    let sessionId: string | null = null;
    const { data: session, error: sErr } = await untyped(context.supabase)
      .from("employee_goal_coach_sessions")
      .insert({
        tenant_id: data.tenant_id,
        manager_id: context.userId,
        employee_id: data.employee_id,
        suggested_targets: output.suggestions ?? [],
        accepted_targets: [],
        session_status: "draft",
        is_beta: true,
      })
      .select("id")
      .single();
    if (sErr) console.error("[employee_goal_coach_sessions] insert failed", sErr.message);
    else sessionId = session?.id ?? null;

    return { sessionId, draft: output };
  });
