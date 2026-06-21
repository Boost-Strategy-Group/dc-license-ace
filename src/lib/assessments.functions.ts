import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Learning Objectives ----------

export const listObjectives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("learning_objectives")
      .select("id, course_id, text, bloom_verb, sort_order")
      .eq("course_id", data.courseId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertObjective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      course_id: z.string().uuid(),
      text: z.string().min(1),
      bloom_verb: z.string().optional(),
      sort_order: z.number().int().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("learning_objectives")
      .upsert(data, { onConflict: "id" })
      .select("id, course_id, text, bloom_verb, sort_order")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteObjective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("learning_objectives").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Assessments + Items ----------

export const listAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("assessments")
      .select("id, course_id, module_id, kind, title, pass_threshold, time_limit_minutes")
      .eq("course_id", data.courseId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      course_id: z.string().uuid(),
      module_id: z.string().uuid().nullable().optional(),
      kind: z.enum(["quiz", "final_exam"]),
      title: z.string().min(1),
      pass_threshold: z.number().min(0).max(100).optional(),
      time_limit_minutes: z.number().int().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("assessments")
      .upsert(data, { onConflict: "id" })
      .select("id, course_id, module_id, kind, title, pass_threshold, time_limit_minutes")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("assessments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAssessmentWithItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: assessment, error } = await context.supabase
      .from("assessments")
      .select("id, course_id, module_id, kind, title, pass_threshold, time_limit_minutes")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!assessment) return null;
    const { data: items, error: iErr } = await context.supabase
      .from("assessment_items")
      .select("id, item_type, stem, choices, rationale, sort_order")
      .eq("assessment_id", data.id)
      .order("sort_order");
    if (iErr) throw new Error(iErr.message);
    return { ...assessment, items: items ?? [] };
  });

// Admin-only: items including `correct` answer
export const getAssessmentAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: assessment } = await context.supabase
      .from("assessments")
      .select("id, course_id, module_id, kind, title, pass_threshold, time_limit_minutes")
      .eq("id", data.id)
      .maybeSingle();
    if (!assessment) return null;
    const { data: items } = await context.supabase
      .from("assessment_items")
      .select("id, item_type, stem, choices, correct, rationale, sort_order")
      .eq("assessment_id", data.id)
      .order("sort_order");
    return { ...assessment, items: items ?? [] };
  });

export const upsertAssessmentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      assessment_id: z.string().uuid(),
      item_type: z.enum(["mcq", "multi", "true_false", "short_answer"]),
      stem: z.string().min(1),
      choices: z.any().optional(),
      correct: z.any().optional(),
      rationale: z.string().optional().nullable(),
      sort_order: z.number().int().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("assessment_items")
      .upsert(data, { onConflict: "id" })
      .select("id, item_type, stem, choices, correct, rationale, sort_order")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAssessmentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("assessment_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Auto-grade an attempt. Only MCQ/multi/T-F auto graded; short answer is stored ungraded.
export const submitAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      assessmentId: z.string().uuid(),
      enrollmentId: z.string().uuid(),
      lessonId: z.string().uuid(),
      answers: z.record(z.string(), z.any()),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: items, error } = await context.supabase
      .from("assessment_items")
      .select("id, item_type, correct")
      .eq("assessment_id", data.assessmentId);
    if (error) throw new Error(error.message);

    let auto = 0;
    let autoTotal = 0;
    for (const it of items ?? []) {
      const ans = data.answers[it.id];
      if (it.item_type === "short_answer") continue;
      autoTotal += 1;
      const correct = it.correct as any;
      if (it.item_type === "multi") {
        const a = Array.isArray(ans) ? [...ans].sort() : [];
        const c = Array.isArray(correct) ? [...correct].sort() : [];
        if (JSON.stringify(a) === JSON.stringify(c)) auto += 1;
      } else {
        if (ans !== undefined && ans !== null && String(ans) === String(correct)) auto += 1;
      }
    }
    const score = autoTotal ? Math.round((auto / autoTotal) * 100) : 0;

    const { data: assessment } = await context.supabase
      .from("assessments")
      .select("pass_threshold")
      .eq("id", data.assessmentId)
      .maybeSingle();
    const passed = score >= Number(assessment?.pass_threshold ?? 70);

    await context.supabase.from("progress").upsert(
      {
        enrollment_id: data.enrollmentId,
        lesson_id: data.lessonId,
        status: passed ? "complete" : "attempted",
        completed_at: passed ? new Date().toISOString() : null,
        score,
      },
      { onConflict: "enrollment_id,lesson_id" },
    );

    return { score, passed, correctCount: auto, total: autoTotal };
  });

// ---------- Surveys (ungraded) ----------

export const listSurveys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("surveys")
      .select("id, course_id, kind, title, schema")
      .eq("course_id", data.courseId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      course_id: z.string().uuid(),
      kind: z.enum(["pre", "post"]),
      title: z.string().min(1),
      schema: z.any(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("surveys")
      .upsert(data, { onConflict: "id" })
      .select("id, course_id, kind, title, schema")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("surveys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      surveyId: z.string().uuid(),
      enrollmentId: z.string().uuid(),
      responses: z.any(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("survey_responses").insert({
      survey_id: data.surveyId,
      enrollment_id: data.enrollmentId,
      user_id: context.userId,
      responses: data.responses,
      submitted_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMySurveyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enrollmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("survey_responses")
      .select("survey_id, submitted_at")
      .eq("enrollment_id", data.enrollmentId);
    return rows ?? [];
  });

// ---------- IACET Publish-gate Readiness ----------

export const getCourseReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [course, na, los, mods, sur, ass, instr] = await Promise.all([
      sb.from("courses").select("id, title, contact_hours, ceu_value, instructor_id, requires_needs_assessment").eq("id", data.courseId).maybeSingle(),
      sb.from("course_needs_assessments").select("id").eq("course_id", data.courseId),
      sb.from("learning_objectives").select("id").eq("course_id", data.courseId),
      sb.from("modules").select("id").eq("course_id", data.courseId),
      sb.from("surveys").select("id, kind").eq("course_id", data.courseId),
      sb.from("assessments").select("id, kind").eq("course_id", data.courseId),
      sb.from("courses").select("instructor:instructors(id, bio, credentials)").eq("id", data.courseId).maybeSingle(),
    ]);
    const c: any = course.data;
    const surveys = sur.data ?? [];
    const instructor: any = (instr.data as any)?.instructor;
    const checks = [
      { id: "needs_assessment", label: "Needs Assessment documented (IACET)", ok: (na.data ?? []).length > 0 },
      { id: "objectives", label: "At least 3 measurable Learning Objectives", ok: (los.data ?? []).length >= 3 },
      { id: "modules", label: "At least one module exists", ok: (mods.data ?? []).length > 0 },
      { id: "assessment", label: "At least one quiz or final exam", ok: (ass.data ?? []).length > 0 },
      { id: "pre_survey", label: "Pre-course survey configured", ok: surveys.some((s: any) => s.kind === "pre") },
      { id: "post_survey", label: "Post-course survey + evaluation configured", ok: surveys.some((s: any) => s.kind === "post") },
      { id: "contact_hours", label: "Contact hours and CEU value set", ok: Number(c?.contact_hours ?? 0) > 0 && Number(c?.ceu_value ?? 0) > 0 },
      { id: "instructor", label: "Instructor assigned with bio and credentials", ok: !!c?.instructor_id && !!instructor?.bio && !!instructor?.credentials },
    ];
    return { checks, ready: checks.every((c) => c.ok) };
  });
