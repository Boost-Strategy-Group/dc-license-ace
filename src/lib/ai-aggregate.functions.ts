import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FEATURE = "bsg_aggregate";

const Input = z.object({
  user_id: z.string().uuid(),
  tenant_ids: z.array(z.string().uuid()).min(1),
  date_range: z.object({ from: z.string(), to: z.string() }),
  dimensions: z.array(z.string()).default([]),
});

export type AggregateInsights = {
  cross_tenant_patterns: string[];
  benchmarks: Array<{ dimension: string; avg_score: number; range: string }>;
  strategic_recommendations: string[];
  narrative: string;
};

// BSG Aggregate LLM — super_admin only. Operates on anonymized, cross-tenant
// dimension scores. No individual data, no PII ever reaches the model.
export const generateAggregateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (!isSuper) throw new Error("Unauthorized");

    const { createOpenAIClient, chatJson, logAiUsage, MODELS, untyped } =
      await import("./openai.server");

    // Pull anonymized dimension averages across the requested tenants. We only
    // ever read aggregate scores — no respondent identifiers leave the DB.
    const { data: rows, error } = await untyped(context.supabase)
      .from("survey_responses")
      .select("tenant_id, dimension, score")
      .in("tenant_id", data.tenant_ids)
      .gte("created_at", data.date_range.from)
      .lte("created_at", data.date_range.to);
    if (error) console.error("[survey_responses] aggregate read failed", error.message);

    const byDimension = new Map<string, { sum: number; n: number; min: number; max: number }>();
    for (const r of (rows ?? []) as Array<{ dimension?: string; score?: number }>) {
      const dim = r.dimension;
      const score = typeof r.score === "number" ? r.score : null;
      if (!dim || score === null) continue;
      if (data.dimensions.length && !data.dimensions.includes(dim)) continue;
      const cur = byDimension.get(dim) ?? { sum: 0, n: 0, min: score, max: score };
      cur.sum += score;
      cur.n += 1;
      cur.min = Math.min(cur.min, score);
      cur.max = Math.max(cur.max, score);
      byDimension.set(dim, cur);
    }
    const aggregates = [...byDimension.entries()].map(([dimension, v]) => ({
      dimension,
      avg_score: Math.round((v.sum / v.n) * 100) / 100,
      range: `${v.min}-${v.max}`,
      sample_size: v.n,
    }));

    const system =
      "You are a workforce analytics consultant providing aggregate insights across multiple organizations. All data is anonymized. Identify industry patterns, benchmarks, and strategic recommendations.";
    const user = `Anonymized aggregate dimension data across ${data.tenant_ids.length} organizations (${data.date_range.from} to ${data.date_range.to}):

${aggregates.map((a) => `- ${a.dimension}: avg ${a.avg_score} (range ${a.range}, n=${a.sample_size})`).join("\n") || "- (no data in range)"}

Return JSON:
{
  "cross_tenant_patterns": ["string", ...],
  "benchmarks": [ { "dimension": "string", "avg_score": number, "range": "string" } ],
  "strategic_recommendations": ["string", ...],
  "narrative": "string"
}`;

    const { data: output, usage } = await chatJson<AggregateInsights>({
      client: createOpenAIClient(),
      model: MODELS.FULL,
      system,
      user,
    });

    await logAiUsage({
      tenant_id: null,
      user_id: context.userId,
      feature: FEATURE,
      model: MODELS.FULL,
      usage,
      metadata: { user_id: context.userId, feature: FEATURE, tenant_ids: data.tenant_ids },
    });

    return { draft: output };
  });
