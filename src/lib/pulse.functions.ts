/**
 * pulse.functions.ts
 * Server functions for Boost!Pulse module.
 * Covers: survey CRUD, learner active survey, anonymous response submission,
 *         dimension scores (with anonymity threshold enforcement), AI insights (publish gate),
 *         dimension reference list.
 *
 * Auth pattern: requireSupabaseAuth middleware → context.supabase + context.userId
 * Anonymity: respondent_hash = sha256(userId + surveyId) — no PII stored
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveTenant(sb: any, slug: string) {
  const { data: tenant, error } = await sb
    .from("tenants")
    .select("id, slug, name, modules_enabled")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tenant) throw new Error("NotFound");
  return tenant;
}

async function getCallerRoles(sb: any, userId: string, tenantId: string) {
  const { data: pRows } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const { data: mRows } = await sb
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  const pRoles = (pRows ?? []).map((r: any) => r.role as string);
  const mRoles = (mRows ?? []).map((m: any) => m.role as string);
  return [...pRoles, ...mRoles];
}

// ---------------------------------------------------------------------------
// Survey List
// ---------------------------------------------------------------------------

export const listPulseSurveys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ slug: z.string().min(1), includeAll: z.boolean().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const isPrivileged = roles.some((r) =>
      ["super_admin", "bsg_admin", "tenant_admin", "admin", "manager"].includes(r),
    );

    let query = sb
      .from("pulse_surveys")
      .select("*, template:pulse_survey_templates(title)")
      .eq("tenant_id", tenant.id);

    if (!isPrivileged || !data.includeAll) {
      query = query.neq("status", "draft");
    }

    const { data: surveys, error } = await query.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return surveys ?? [];
  });

// ---------------------------------------------------------------------------
// Active Survey for Learner
// ---------------------------------------------------------------------------

export const getActiveSurveyForLearner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const now = new Date().toISOString();
    const { data: survey, error } = await sb
      .from("pulse_surveys")
      .select("*, questions:pulse_questions(*, dimension:pulse_survey_dimensions(name, category))")
      .eq("tenant_id", tenant.id)
      .eq("status", "active")
      .lte("start_date", now)
      .gte("end_date", now)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!survey) return null;

    // Check if caller already responded
    const respondent_hash = createHash("sha256")
      .update(`${context.userId}:${survey.id}`)
      .digest("hex");
    const { data: existing } = await sb
      .from("pulse_responses")
      .select("id")
      .eq("survey_id", survey.id)
      .eq("respondent_hash", respondent_hash)
      .maybeSingle();

    return { survey, already_responded: !!existing };
  });

// ---------------------------------------------------------------------------
// Submit Response — anonymized
// ---------------------------------------------------------------------------

export const submitSurveyResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        survey_id: z.string().uuid(),
        slug: z.string().min(1),
        answers: z.array(
          z.object({
            question_id: z.string().uuid(),
            score: z.number().int().min(1).max(7).optional(),
            text_answer: z.string().max(2000).optional(),
          }),
        ),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    // Anonymity hash — no PII
    const respondent_hash = createHash("sha256")
      .update(`${context.userId}:${data.survey_id}`)
      .digest("hex");

    // Guard duplicate submission
    const { data: existing } = await sb
      .from("pulse_responses")
      .select("id")
      .eq("survey_id", data.survey_id)
      .eq("respondent_hash", respondent_hash)
      .maybeSingle();
    if (existing) throw new Error("Already responded to this survey");

    // Insert response
    const { data: response, error: rErr } = await sb
      .from("pulse_responses")
      .insert({
        survey_id: data.survey_id,
        tenant_id: tenant.id,
        respondent_hash,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (rErr) throw new Error(rErr.message);

    // Insert answers
    const answerRows = data.answers.map((a) => ({
      response_id: response.id,
      question_id: a.question_id,
      score: a.score ?? null,
      text_answer: a.text_answer ?? null,
    }));
    const { error: aErr } = await sb.from("pulse_response_answers").insert(answerRows);
    if (aErr) throw new Error(aErr.message);

    return { success: true };
  });

// ---------------------------------------------------------------------------
// Dimension Scores (with anonymity threshold)
// ---------------------------------------------------------------------------

export const getDimensionScores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ slug: z.string().min(1), survey_id: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    // Resolve anonymity threshold from survey
    const { data: survey, error: sErr } = await sb
      .from("pulse_surveys")
      .select("anonymity_threshold, title")
      .eq("id", data.survey_id)
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!survey) throw new Error("Survey not found");
    const threshold = survey.anonymity_threshold ?? 5;

    // Only return scores where response_count >= threshold
    const { data: scores, error } = await sb
      .from("pulse_dimension_scores")
      .select("*, dimension:pulse_survey_dimensions(name, category, description)")
      .eq("survey_id", data.survey_id)
      .eq("tenant_id", tenant.id)
      .gte("response_count", threshold)
      .order("avg_score", { ascending: false });
    if (error) throw new Error(error.message);

    // Get total response count regardless of threshold
    const { count: totalResponses } = await sb
      .from("pulse_responses")
      .select("id", { count: "exact", head: true })
      .eq("survey_id", data.survey_id)
      .eq("tenant_id", tenant.id);

    return {
      scores: scores ?? [],
      threshold,
      total_responses: totalResponses ?? 0,
      below_threshold: (totalResponses ?? 0) < threshold,
    };
  });

// ---------------------------------------------------------------------------
// Pulse AI Insights — publish gate
// ---------------------------------------------------------------------------

export const getPulseInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ slug: z.string().min(1), survey_id: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const isPrivileged = roles.some((r) =>
      ["super_admin", "bsg_admin", "tenant_admin", "admin"].includes(r),
    );

    let query = sb
      .from("pulse_ai_insights")
      .select("*")
      .eq("survey_id", data.survey_id)
      .eq("tenant_id", tenant.id);

    // Non-privileged (managers, learners) only see published insights
    if (!isPrivileged) {
      query = query.eq("status", "published");
    }

    const { data: insights, error } = await query.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return insights ?? [];
  });

export const publishPulseInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ insight_id: z.string().uuid(), slug: z.string().min(1) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    const canPublish = roles.some((r) =>
      ["super_admin", "bsg_admin", "tenant_admin", "admin"].includes(r),
    );
    if (!canPublish) throw new Error("Forbidden: admin required to publish insights");

    const { error } = await sb
      .from("pulse_ai_insights")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", data.insight_id)
      .eq("tenant_id", tenant.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ---------------------------------------------------------------------------
// Dimension Reference (GPTW/Gallup/Aristotle/Edmondson/Custom)
// ---------------------------------------------------------------------------

export const listDimensions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    if (!context.userId) throw new Error("Unauthorized");
    const { data, error } = await sb
      .from("pulse_survey_dimensions")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
