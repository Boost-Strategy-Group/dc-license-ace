import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CourseRow = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  description: string | null;
  audience: string | null;
  contact_hours: number | null;
  ceu_value: number | null;
  delivery_modes: string[] | null;
  language: string | null;
  status: string;
  dependency_mode: string;
  requires_needs_assessment: boolean;
  instructor_id: string | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
};

const courseCols =
  "id, tenant_id, slug, title, description, audience, contact_hours, ceu_value, delivery_modes, language, status, dependency_mode, requires_needs_assessment, instructor_id, cover_image_url, created_at, updated_at";

// ---------- Courses ----------

export const listCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tenantId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("courses").select(courseCols).order("updated_at", { ascending: false });
    if (data.tenantId) q = q.eq("tenant_id", data.tenantId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as CourseRow[];
  });

export const listPublishedCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("courses")
      .select(courseCols + ", tenant:tenants(name, slug, brand_primary, logo_url)")
      .eq("status", "published")
      .order("title");
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const getCourse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: course, error } = await context.supabase
      .from("courses")
      .select(courseCols)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return course as CourseRow | null;
  });

const upsertCourseInput = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  audience: z.string().nullable().optional(),
  contact_hours: z.number().nullable().optional(),
  ceu_value: z.number().nullable().optional(),
  delivery_modes: z.array(z.enum(["self_paced", "hybrid", "live"])).optional(),
  language: z.string().optional(),
  status: z.enum(["draft", "review", "published", "archived"]).optional(),
  dependency_mode: z.enum(["open", "sequential", "custom"]).optional(),
  requires_needs_assessment: z.boolean().optional(),
  cover_image_url: z.string().url().nullable().optional(),
});

export const upsertCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertCourseInput.parse(input))
  .handler(async ({ data, context }) => {
    const payload = { ...data, created_by: context.userId };
    const { data: row, error } = await context.supabase
      .from("courses")
      .upsert(payload, { onConflict: "id" })
      .select(courseCols)
      .single();
    if (error) throw new Error(error.message);
    return row as CourseRow;
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("courses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Modules ----------

export const listModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("modules")
      .select("id, course_id, title, summary, sort_order")
      .eq("course_id", data.courseId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        course_id: z.string().uuid(),
        title: z.string().min(1),
        summary: z.string().nullable().optional(),
        sort_order: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("modules")
      .upsert(data, { onConflict: "id" })
      .select("id, course_id, title, summary, sort_order")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("modules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Lessons ----------

export const listLessons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: modules, error: mErr } = await context.supabase
      .from("modules")
      .select("id")
      .eq("course_id", data.courseId);
    if (mErr) throw new Error(mErr.message);
    const ids = (modules ?? []).map((m) => m.id);
    if (!ids.length) return [];
    const { data: rows, error } = await context.supabase
      .from("lessons")
      .select("id, module_id, title, kind, content, duration_minutes, sort_order")
      .in("module_id", ids)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        module_id: z.string().uuid(),
        title: z.string().min(1),
        kind: z.enum(["video", "text", "file", "quiz", "activity", "exam", "heygen", "zoom_live", "talentlms"]),
        content: z.any().optional(),
        duration_minutes: z.number().int().optional(),
        sort_order: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("lessons")
      .upsert(data, { onConflict: "id" })
      .select("id, module_id, title, kind, content, duration_minutes, sort_order")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lessons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Enrollments ----------

export const listMyEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("enrollments")
      .select(
        "id, course_id, status, started_at, completed_at, ceu_awarded, course:courses(id, title, slug, cover_image_url, tenant:tenants(name, brand_primary, logo_url))",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const enrollInCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        courseId: z.string().uuid(),
        fundingSource: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: course, error: cErr } = await context.supabase
      .from("courses")
      .select("id, tenant_id, status")
      .eq("id", data.courseId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!course) throw new Error("Course not found");

    const { data: row, error } = await context.supabase
      .from("enrollments")
      .upsert(
        {
          course_id: data.courseId,
          tenant_id: course.tenant_id,
          user_id: context.userId,
          status: "active",
          funding_source: data.fundingSource ?? "self_pay",
          started_at: new Date().toISOString(),
        },
        { onConflict: "course_id,user_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getCoursePlayer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ courseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: course, error } = await context.supabase
      .from("courses")
      .select(
        courseCols +
          ", modules:modules(id, title, summary, sort_order, lessons:lessons(id, title, kind, content, duration_minutes, sort_order))",
      )
      .eq("id", data.courseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!course) return null;

    const { data: enrollment } = await context.supabase
      .from("enrollments")
      .select("id, status, completed_at")
      .eq("course_id", data.courseId)
      .eq("user_id", context.userId)
      .maybeSingle();

    let progress: any[] = [];
    if (enrollment) {
      const { data: prog } = await context.supabase
        .from("progress")
        .select("lesson_id, status, completed_at, score")
        .eq("enrollment_id", enrollment.id);
      progress = prog ?? [];
    }
    return { course, enrollment, progress };
  });

export const markLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ enrollmentId: z.string().uuid(), lessonId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("progress").upsert(
      {
        enrollment_id: data.enrollmentId,
        lesson_id: data.lessonId,
        status: "complete",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "enrollment_id,lesson_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Vault ----------

export const listMyVault = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("student_vault_items")
      .select("id, kind, title, file_url, metadata, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
