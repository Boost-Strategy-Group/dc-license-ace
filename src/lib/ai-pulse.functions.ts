import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FEATURE = "pulse_insights";

const Input = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  survey_id: z.string().uuid(),
  dimension_scores: z
    .array(z.object({ dimension: z.string(), score: z.number(), benchmark: z.string() }))
    .default([]),
  verbatim_themes: z.array(z.string()).default([]),
  response_count: z.number().int().nonnegative(),
  anonymity_threshold: z.number().int().positive(),
});

export type PulseInsights = {
  summary: string;
  strengths: string[];
  opportunities: string[];
  recommended_actions: Array<{
    action: string;
    priority: "high" | "medium" | "low";
    owner: string;
  }>;
  narrative: string;
};

// Pulse Insights (Boost!Pulse). Stored as draft; must be published by a
// tenant_admin or bsg_admin (super_admin). Hard anonymity gate enforced first.
export const generatePulseInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    // CRITICAL anonymity gate — never run AI on too few responses.
    if (data.response_count < data.anonymity_threshold) {
      throw new Error(
        `Insufficient responses for AI insights — minimum ${data.anonymity_threshold} required`,
      );
    }

    const { createOpenAIClient, chatJson, logAiUsage, MODELS, untyped } =
      await import("./openai.server");

    const system =
      "You are an organizational health analyst. Analyze employee survey results and generate actionable insights. Do not identify individuals. Focus on systemic patterns, team strengths, and concrete improvement recommendations.";
    const user = `Analyze this anonymized survey (response count: ${data.response_count}).

Dimension scores:
${data.dimension_scores.map((d) => `- ${d.dimension}: ${d.score} (benchmark: ${d.benchmark})`).join("\n") || "- (none)"}
Verbatim themes:
${data.verbatim_themes.map((t) => `- ${t}`).join("\n") || "- (none)"}

Return JSON:
{
  "summary": "string",
  "strengths": ["string", ...],
  "opportunities": ["string", ...],
  "recommended_actions": [ { "action": "string", "priority": "high|medium|low", "owner": "string" } ],
  "narrative": "string"
}`;

    const { data: output, usage } = await chatJson<PulseInsights>({
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
        survey_id: data.survey_id,
      },
    });

    // Stored with status draft (published_at null = draft).
    let insightId: string | null = null;
    const { data: row, error: iErr } = await untyped(context.supabase)
      .from("pulse_ai_insights")
      .insert({
        survey_id: data.survey_id,
        tenant_id: data.tenant_id,
        insight_type: "pulse_summary",
        content_json: output,
        model_used: MODELS.FULL,
        published_at: null,
        generated_by: context.userId,
      })
      .select("id")
      .single();
    if (iErr) console.error("[pulse_ai_insights] insert failed", iErr.message);
    else insightId = row?.id ?? null;

    return { insightId, status: "draft" as const, draft: output };
  });
