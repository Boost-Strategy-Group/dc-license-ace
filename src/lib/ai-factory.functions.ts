import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-2.5-flash";

async function aiJson(prompt: string, system: string): Promise<unknown> {
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
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
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
    const output = (await aiJson(prompt, system)) as Record<string, unknown>;

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
        inputs: data,
        output,
        citations: (output.citations as unknown[]) ?? [],
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
      input: data,
      output,
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
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || `course-${Date.now()}`;
}

export const generateCourseFromAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => FactoryInput.parse(i))
  .handler(async ({ data, context }) => {
    // Permission: super admin OR tenant admin/owner
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (!isSuper) {
      const { data: isTenantAdmin } = await context.supabase.rpc("has_tenant_role", {
        _tenant_id: data.tenantId,
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isTenantAdmin) throw new Error("Forbidden: requires admin role on this tenant");
    }

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

Return JSON:
{
  "description": "1-paragraph course description",
  "ceu_value": number,  // typically contact_hours / 10
  "learning_objectives": [ { "text": "Learners will be able to...", "bloom_level": "remember|understand|apply|analyze|evaluate|create" } ],  // at least 4
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
    "passing_score": 80,
    "items": [
      { "stem": "string", "kind": "mcq", "options": ["a","b","c","d"], "answer_index": 0, "rationale": "string" }
    ]  // 5-10 items
  },
  "pre_survey_prompt": "string asking learners about prior confidence",
  "post_survey_prompt": "string asking learners to evaluate the course"
}`;

    const plan = (await aiJson(prompt, system)) as {
      description: string;
      ceu_value: number;
      learning_objectives: { text: string; bloom_level: string }[];
      modules: { title: string; summary: string; lessons: { title: string; kind: string; summary: string; duration_minutes: number }[] }[];
      final_quiz: { title: string; passing_score: number; items: { stem: string; kind: string; options: string[]; answer_index: number; rationale: string }[] };
      pre_survey_prompt?: string;
      post_survey_prompt?: string;
    };

    // Create course
    const slug = slugify(data.title) + "-" + Math.random().toString(36).slice(2, 6);
    const { data: course, error: cErr } = await context.supabase
      .from("courses")
      .insert({
        tenant_id: data.tenantId,
        slug,
        title: data.title,
        description: plan.description,
        audience: data.audience,
        contact_hours: data.durationHours,
        ceu_value: plan.ceu_value ?? Math.round((data.durationHours / 10) * 10) / 10,
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

    // Learning objectives
    if (plan.learning_objectives?.length) {
      await context.supabase.from("learning_objectives").insert(
        plan.learning_objectives.map((lo, i) => ({
          course_id: course.id,
          text: lo.text,
          bloom_level: lo.bloom_level || "understand",
          position: i,
        })),
      );
    }

    // Modules + lessons
    for (let mi = 0; mi < (plan.modules ?? []).length; mi++) {
      const m = plan.modules[mi];
      const { data: mod, error: mErr } = await context.supabase
        .from("modules")
        .insert({ course_id: course.id, title: m.title, summary: m.summary, position: mi })
        .select("id")
        .single();
      if (mErr) throw new Error(mErr.message);

      const lessonsToInsert = (m.lessons ?? []).map((l, li) => ({
        course_id: course.id,
        module_id: mod.id,
        title: l.title,
        kind: ["video", "text", "activity", "quiz", "exam", "file", "heygen", "zoom_live", "talentlms"].includes(l.kind) ? l.kind : "text",
        position: li,
        content: { summary: l.summary, duration_minutes: l.duration_minutes },
      }));
      if (lessonsToInsert.length) {
        await context.supabase.from("lessons").insert(lessonsToInsert);
      }
    }

    // Final exam assessment + items
    if (plan.final_quiz?.items?.length) {
      const { data: assessment, error: aErr } = await context.supabase
        .from("assessments")
        .insert({
          course_id: course.id,
          title: plan.final_quiz.title ?? "Final exam",
          kind: "final_exam",
          passing_score: plan.final_quiz.passing_score ?? 80,
        })
        .select("id")
        .single();
      if (aErr) throw new Error(aErr.message);

      await context.supabase.from("assessment_items").insert(
        plan.final_quiz.items.map((it, i) => ({
          assessment_id: assessment.id,
          stem: it.stem,
          kind: it.kind || "mcq",
          options: it.options,
          answer: { index: it.answer_index },
          rationale: it.rationale,
          position: i,
          points: 1,
        })),
      );
    }

    // Pre + post surveys (ungraded)
    await context.supabase.from("surveys").insert([
      {
        course_id: course.id,
        kind: "pre_course",
        title: "Pre-course confidence survey",
        schema: { prompt: plan.pre_survey_prompt ?? "Rate your prior confidence on each objective (1-5).", scale: "likert_1_5" },
      },
      {
        course_id: course.id,
        kind: "post_course",
        title: "Post-course evaluation",
        schema: { prompt: plan.post_survey_prompt ?? "Rate the course and your post-course confidence (1-5).", scale: "likert_1_5" },
      },
    ]);

    await context.supabase.from("ai_generations").insert({
      kind: "course_factory",
      course_id: course.id,
      tenant_id: data.tenantId,
      user_id: context.userId,
      model: MODEL,
      input: data,
      output: plan,
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

    // Save response
    const { data: respRow, error: rErr } = await context.supabase
      .from("activity_responses")
      .insert({
        activity_id: data.activityId,
        enrollment_id: data.enrollmentId,
        user_id: context.userId,
        response: data.response,
      })
      .select("id")
      .single();
    if (rErr) throw new Error(rErr.message);

    // Generate work products
    const wpIds = (activity.work_product_ids ?? []) as string[];
    const generated: { title: string; content: unknown }[] = [];
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
        metadata: { activity_id: activity.id, course_id: activity.course_id, content: output },
      });
    }

    await context.supabase
      .from("activity_responses")
      .update({ ai_output: generated as unknown as object })
      .eq("id", respRow.id);

    await context.supabase.from("ai_generations").insert({
      kind: "work_product",
      course_id: activity.course_id,
      user_id: context.userId,
      model: MODEL,
      input: { activityId: activity.id, response: data.response },
      output: generated,
    });

    return { responseId: respRow.id, generated };
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
    const { data: row, error } = await context.supabase
      .from("activities")
      .upsert(data)
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
    const { data: row, error } = await context.supabase
      .from("work_products")
      .upsert(data)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
