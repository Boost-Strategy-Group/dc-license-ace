import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FEATURE = "potential_rating";

const Factor = z.number().int().min(1).max(3);

const Input = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  learning_agility: Factor,
  aspiration: Factor,
  capability_ceiling: Factor,
  performance_history: z.string().default(""),
  tenure_months: z.number().int().nonnegative().default(0),
  role_complexity: z.string().default(""),
});

export type PotentialInsight = {
  potential_level: string;
  composite_score: number;
  narrative: string;
  development_suggestions: string[];
  manager_coaching_tips: string[];
};

function toLevel(score: number): "developing" | "growth" | "high" {
  if (score < 1.67) return "developing";
  if (score <= 2.33) return "growth";
  return "high";
}

// Potential Rating AI Assist (Boost!Perform). Advisory only — the manager must
// explicitly confirm before anything is written to potential_ratings.
export const generatePotentialRatingInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    // zod already enforces 1-3 integers; this guards against any bypass.
    for (const [name, v] of [
      ["learning_agility", data.learning_agility],
      ["aspiration", data.aspiration],
      ["capability_ceiling", data.capability_ceiling],
    ] as const) {
      if (!Number.isInteger(v) || v < 1 || v > 3) {
        throw new Error(`${name} must be an integer between 1 and 3`);
      }
    }

    const composite_score =
      Math.round(((data.learning_agility + data.aspiration + data.capability_ceiling) / 3) * 100) /
      100;
    const potential_level = toLevel(composite_score);

    const { createOpenAIClient, chatJson, logAiUsage, MODELS } = await import("./openai.server");

    const system =
      "You are a talent analytics advisor. Based on a manager's assessment scores, provide a balanced narrative interpretation of this employee's potential rating. Highlight that potential is dynamic, not fixed. Avoid language that could stigmatize.";
    const user = `Interpret this potential assessment.

Scores (1-3 scale):
- Learning agility: ${data.learning_agility}
- Aspiration: ${data.aspiration}
- Capability ceiling: ${data.capability_ceiling}
Composite score: ${composite_score} → level: ${potential_level}
Tenure (months): ${data.tenure_months}
Role complexity: ${data.role_complexity || "(unspecified)"}
Performance history: ${data.performance_history || "(none provided)"}

Return JSON:
{
  "potential_level": "${potential_level}",
  "composite_score": ${composite_score},
  "narrative": "string",
  "development_suggestions": ["string", ...],
  "manager_coaching_tips": ["string", ...]
}`;

    const { data: output, usage } = await chatJson<PotentialInsight>({
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

    // Advisory result — return computed values authoritatively, never auto-saved.
    return {
      draft: { ...output, potential_level, composite_score },
    };
  });
