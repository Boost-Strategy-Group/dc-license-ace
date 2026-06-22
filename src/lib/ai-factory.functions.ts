import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-2.5-flash";

// Loose Json helper to satisfy strict Database Insert types without losing intent.
type Json = never;
const J = (v: unknown) => v as Json;

async function aiJson(prompt: string, system: string): Promise<Record<string, unknown>> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const { generateText } = await import("ai");
  const gateway = createLovableAiGatewayProvider(key);
  const { text } = await generateText({
    model: gateway(MODEL),
    system: system + "\n\nReturn ONLY valid JSON, no markdown fences, no commentary.",
    prompt,
  });
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    throw new Error("AI returned invalid JSON");
  }
}

// ---------- AI Needs Assessment ----------

const NeedsInput = z.object({
  courseId: z.string().uuid(),
  industry: z.string().min(1),
  audience: z.string().min(1),
  problem: z.string().min(1),
  desiredOutcomes: z.string().min(1),
  regulatoryContext: z.string().optional().default(""),
});

export const generateNeedsAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => NeedsInput.parse(i))
  .handler(async ({ data, context }) => {
    const system =
      "You are an instructional designer producing IACET-aligned needs assessments. Be specific, evidence-based, and include realistic citation suggestions (publisher, year, topic — no fabricated URLs).";
    const prompt = `Produce a Needs Assessment for a course.

Industry: ${data.industry}
Target audience: ${data.audience}
Problem / performance gap: ${data.problem}
Desired learner outcomes: ${data.desiredOutcomes}
Regulatory / compliance context: ${data.regulatoryContext || "n/a"}

Return JSON with this shape:
{
  "summary": "2-3 sentence executive summary",
  "industry_analysis": "string, 1-2 paragraphs",
  "audience_profile": "string",
  "learning_gap_analysis": "string",
  "recommended_outcomes": ["string", ...],
  "delivery_recommendations": "string",
  "citations": [ { "source": "string", "year": number, "topic": "string" } ]
}`;
    const output = await aiJson(prompt, system);

    const { data: existing } = await context.supabase
      .from("course_needs_assessments")
      .select("version")
      .eq("course_id", data.courseId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (existing?.version ?? 0) + 1;

    const { data: row, error } = await context.supabase
      .from("course_needs_assessments")
      .insert({
        course_id: data.courseId,
        version: nextVersion,
        inputs: J(data),
        output: J(output),
        citations: J((output.citations as unknown[]) ?? []),
        generated_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("ai_generations").insert({
      kind: "needs_assessment",
      course_id: data.courseId,
      user_id: context.userId,
      model: MODEL,
      input: J(data),
      output: J(output),
    });
    return row;
  });

export const listNeedsAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ courseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("course_needs_assessments")
      .select("*")
      .eq("course_id", data.courseId)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- AI Course Factory ----------

const FactoryInput = z.object({
  tenantId: z.string().uuid(),
  title: z.string().min(1),
  audience: z.string().min(1),
  objectives: z.string().min(1),
  durationHours: z.number().min(0.25).max(200),
  certificationType: z.string().optional().default(""),
  industry: z.string().min(1),
  outcomes: z.string().min(1),
  refinementNotes: z.string().optional().default(""),
});

const LessonPlan = z.object({
  title: z.string(),
  kind: z.string(),
  summary: z.string().default(""),
  duration_minutes: z.number().nullable().optional(),
});
const ModulePlan = z.object({
  title: z.string(),
  summary: z.string().default(""),
  lessons: z.array(LessonPlan).default([]),
});
const QuizItem = z.object({
  stem: z.string(),
  options: z.array(z.string()).default([]),
  answer_index: z.number().int().min(0).default(0),
  rationale: z.string().default(""),
});
const CoursePlanSchema = z.object({
  description: z.string(),
  ceu_value: z.number(),
  learning_objectives: z
    .array(z.object({ text: z.string(), bloom_verb: z.string().default("Understand") }))
    .default([]),
  modules: z.array(ModulePlan).default([]),
  final_quiz: z
    .object({
      title: z.string().default("Final exam"),
      pass_threshold: z.number().default(80),
      items: z.array(QuizItem).default([]),
    })
    .default({ title: "Final exam", pass_threshold: 80, items: [] }),
  pre_survey_prompt: z.string().optional().default(""),
  post_survey_prompt: z.string().optional().default(""),
});
export type CoursePlan = z.infer<typeof CoursePlanSchema>;
export type FactoryBrief = z.infer<typeof FactoryInput>;

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || `course-${Date.now()}`;
}

type AuthedSupabase = {
  rpc: {
    (n: "is_super_admin", a: { _user_id: string }): Promise<{ data: boolean | null }>;
    (n: "has_tenant_role", a: { _tenant_id: string; _user_id: string; _role: "admin" }): Promise<{ data: boolean | null }>;
  };
};

async function assertCanAuthor(supabase: unknown, userId: string, tenantId: string) {
  const sb = supabase as AuthedSupabase;
  const { data: isSuper } = await sb.rpc("is_super_admin", { _user_id: userId });
  if (isSuper) return;
  const { data: isTenantAdmin } = await sb.rpc("has_tenant_role", {
    _tenant_id: tenantId,
    _user_id: userId,
    _role: "admin",
  });
  if (!isTenantAdmin) throw new Error("Forbidden: requires admin role on this tenant");
}

export const draftCourseFromAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FactoryInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertCanAuthor(context.supabase, context.userId, data.tenantId);

    const system =
      "You are an expert instructional designer building IACET-aligned courses. Write measurable Bloom's-taxonomy objectives. Produce realistic module structure for the requested duration. Quiz items should have 4 options with one correct and a short rationale.";
    const prompt = `Design a complete course.

Title: ${data.title}
Industry: ${data.industry}
Target audience: ${data.audience}
Duration (contact hours): ${data.durationHours}
Certification type: ${data.certificationType || "none"}
Stated objectives: ${data.objectives}
Desired learner outcomes: ${data.outcomes}
${data.refinementNotes ? `\nAdditional refinement notes from the author: ${data.refinementNotes}\n` : ""}
Return JSON:
{
  "description": "1-paragraph course description",
  "ceu_value": number,
  "learning_objectives": [ { "text": "Learners will be able to...", "bloom_verb": "Apply|Analyze|Evaluate|Create|Understand|Remember" } ],
  "modules": [
    {
      "title": "string",
      "summary": "string",
      "lessons": [
        { "title": "string", "kind": "video|text|activity|quiz", "summary": "string", "duration_minutes": number }
      ]
    }
  ],
  "final_quiz": {
    "title": "Final exam",
    "pass_threshold": 80,
    "items": [
      { "stem": "string", "options": ["a","b","c","d"], "answer_index": 0, "rationale": "string" }
    ]
  },
  "pre_survey_prompt": "string",
  "post_survey_prompt": "string"
}`;

    const raw = await aiJson(prompt, system);
    const plan = CoursePlanSchema.parse(raw);

    await context.supabase.from("ai_generations").insert({
      kind: "course_factory_draft",
      tenant_id: data.tenantId,
      user_id: context.userId,
      model: MODEL,
      input: J(data),
      output: J(plan),
    });

    return { plan };
  });

const CreateFromPlanInput = z.object({
  input: FactoryInput,
  plan: CoursePlanSchema,
});

export const createCourseFromPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateFromPlanInput.parse(i))
  .handler(async ({ data, context }) => {
    const { input, plan } = data;
    await assertCanAuthor(context.supabase, context.userId, input.tenantId);

    const slug = slugify(input.title) + "-" + Math.random().toString(36).slice(2, 6);
    const { data: course, error: cErr } = await context.supabase
      .from("courses")
      .insert({
        tenant_id: input.tenantId,
        slug,
        title: input.title,
        description: plan.description,
        audience: input.audience,
        contact_hours: input.durationHours,
        ceu_value: plan.ceu_value ?? Math.round((input.durationHours / 10) * 10) / 10,
        delivery_modes: ["self_paced"],
        language: "en",
        status: "draft",
        dependency_mode: "sequential",
        requires_needs_assessment: true,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (cErr) throw new Error(cErr.message);

    if (plan.learning_objectives?.length) {
      await context.supabase.from("learning_objectives").insert(
        plan.learning_objectives.map((lo, i) => ({
          course_id: course.id,
          text: lo.text,
          bloom_verb: lo.bloom_verb || "Understand",
          sort_order: i,
        })),
      );
    }

    const validKinds = ["video", "text", "activity", "quiz", "exam", "file", "heygen", "zoom_live", "talentlms"];
    for (let mi = 0; mi < (plan.modules ?? []).length; mi++) {
      const m = plan.modules[mi];
      const { data: mod, error: mErr } = await context.supabase
        .from("modules")
        .insert({ course_id: course.id, title: m.title, summary: m.summary, sort_order: mi })
        .select("id")
        .single();
      if (mErr) throw new Error(mErr.message);

      const lessonsToInsert = (m.lessons ?? []).map((l, li) => ({
        module_id: mod.id,
        title: l.title,
        kind: validKinds.includes(l.kind) ? l.kind : "text",
        sort_order: li,
        duration_minutes: l.duration_minutes ?? null,
        content: J({ summary: l.summary }),
      }));
      if (lessonsToInsert.length) {
        await context.supabase.from("lessons").insert(lessonsToInsert);
      }
    }

    if (plan.final_quiz?.items?.length) {
      const { data: assessment, error: aErr } = await context.supabase
        .from("assessments")
        .insert({
          course_id: course.id,
          title: plan.final_quiz.title ?? "Final exam",
          kind: "final_exam",
          pass_threshold: plan.final_quiz.pass_threshold ?? 80,
        })
        .select("id")
        .single();
      if (aErr) throw new Error(aErr.message);

      await context.supabase.from("assessment_items").insert(
        plan.final_quiz.items.map((it, i) => ({
          assessment_id: assessment.id,
          stem: it.stem,
          item_type: "mcq",
          choices: J(it.options),
          correct: J({ index: it.answer_index }),
          rationale: it.rationale,
          sort_order: i,
        })),
      );
    }

    await context.supabase.from("surveys").insert([
      {
        course_id: course.id,
        kind: "pre_course",
        title: "Pre-course confidence survey",
        schema: J({ prompt: plan.pre_survey_prompt ?? "Rate your prior confidence (1-5).", scale: "likert_1_5" }),
      },
      {
        course_id: course.id,
        kind: "post_course",
        title: "Post-course evaluation",
        schema: J({ prompt: plan.post_survey_prompt ?? "Rate the course and your post-course confidence (1-5).", scale: "likert_1_5" }),
      },
    ]);

    await context.supabase.from("ai_generations").insert({
      kind: "course_factory",
      course_id: course.id,
      tenant_id: input.tenantId,
      user_id: context.userId,
      model: MODEL,
      input: J(input),
      output: J(plan),
    });

    return { courseId: course.id, slug: course.slug };
  });

// ---------- AI Work Product Engine ----------

const WorkProductInput = z.object({
  activityId: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  response: z.record(z.string(), z.unknown()),
});

export const submitActivityAndGenerate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => WorkProductInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: activity, error: aErr } = await context.supabase
      .from("activities")
      .select("id, title, prompt, schema, course_id, work_product_ids")
      .eq("id", data.activityId)
      .single();
    if (aErr) throw new Error(aErr.message);

    const { data: respRow, error: rErr } = await context.supabase
      .from("activity_responses")
      .insert({
        activity_id: data.activityId,
        enrollment_id: data.enrollmentId,
        user_id: context.userId,
        response: J(data.response),
      })
      .select("id")
      .single();
    if (rErr) throw new Error(rErr.message);

    const wpIds = (activity.work_product_ids ?? []) as string[];
    const generated: { title: string; content: Record<string, unknown> }[] = [];
    for (const wpId of wpIds) {
      const { data: wp } = await context.supabase
        .from("work_products")
        .select("id, title, kind, template")
        .eq("id", wpId)
        .single();
      if (!wp) continue;

      const system =
        "You are a business consultant transforming learner inputs into a polished professional deliverable. Use the supplied template structure. Write in clear, executive-ready prose.";
      const prompt = `Activity: ${activity.title}
Activity prompt: ${activity.prompt ?? ""}
Learner responses (JSON): ${JSON.stringify(data.response)}

Generate a "${wp.title}" (${wp.kind}) following this template:
${JSON.stringify(wp.template)}

Return JSON: { "title": "string", "sections": [ { "heading": "string", "body": "markdown string" } ] }`;
      const output = await aiJson(prompt, system);
      generated.push({ title: wp.title, content: output });

      await context.supabase.from("student_vault_items").insert({
        user_id: context.userId,
        kind: wp.kind,
        title: wp.title,
        source_id: respRow.id,
        metadata: J({ activity_id: activity.id, course_id: activity.course_id, content: output }),
      });
    }

    await context.supabase
      .from("activity_responses")
      .update({ ai_output: J(generated) })
      .eq("id", respRow.id);

    await context.supabase.from("ai_generations").insert({
      kind: "work_product",
      course_id: activity.course_id,
      user_id: context.userId,
      model: MODEL,
      input: J({ activityId: activity.id, response: data.response }),
      output: J(generated),
    });

    return { responseId: respRow.id, generated: JSON.parse(JSON.stringify(generated)) as Array<{ title: string; content: { sections?: Array<{ heading?: string; body?: string }> } }> };
  });

export const listActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ courseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("activities")
      .select("*")
      .eq("course_id", data.courseId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const ActivityUpsert = z.object({
  id: z.string().uuid().optional(),
  course_id: z.string().uuid(),
  title: z.string().min(1),
  prompt: z.string().optional().default(""),
  placement: z.string().default("module"),
  schema: z.record(z.string(), z.unknown()).default({}),
  module_ids: z.array(z.string().uuid()).optional(),
  work_product_ids: z.array(z.string().uuid()).optional(),
});

export const upsertActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ActivityUpsert.parse(i))
  .handler(async ({ data, context }) => {
    const payload = { ...data, schema: J(data.schema) };
    const { data: row, error } = await context.supabase
      .from("activities")
      .upsert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listWorkProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ courseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("work_products")
      .select("*")
      .eq("course_id", data.courseId)
      .order("title");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const WorkProductUpsert = z.object({
  id: z.string().uuid().optional(),
  course_id: z.string().uuid(),
  title: z.string().min(1),
  kind: z.string().min(1),
  template: z.record(z.string(), z.unknown()).default({}),
});

export const upsertWorkProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => WorkProductUpsert.parse(i))
  .handler(async ({ data, context }) => {
    const payload = { ...data, template: J(data.template) };
    const { data: row, error } = await context.supabase
      .from("work_products")
      .upsert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
