/**
 * learn.functions.ts
 * Server functions for Boost!Learn module.
 * Covers: published courses (+ admin all), enrollments, enroll, progress update,
 *         learning paths, path enrollment, certificates, content library, AI recommendations.
 *
 * Auth pattern: requireSupabaseAuth middleware → context.supabase + context.userId
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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

async function resolveLearner(sb: any, userId: string) {
  const { data, error } = await sb
    .from("learners")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Learner profile not found");
  return data;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export const listPublishedCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const { data: courses, error } = await sb
      .from("courses")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return courses ?? [];
  });

export const listAllCoursesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    const isPrivileged = roles.some((r) =>
      ["super_admin", "bsg_admin", "tenant_admin", "admin"].includes(r),
    );
    if (!isPrivileged) throw new Error("Forbidden: admin access required");

    const { data: courses, error } = await sb
      .from("courses")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return courses ?? [];
  });

// ---------------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------------

export const getMyEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const learner = await resolveLearner(sb, context.userId);

    const { data: enrollments, error } = await sb
      .from("enrollments")
      .select("*, course:courses(*), progress:course_progress(*)")
      .eq("tenant_id", tenant.id)
      .eq("learner_id", learner.id)
      .neq("status", "completed")
      .order("enrolled_at", { ascending: false });
    if (error) throw new Error(error.message);
    return enrollments ?? [];
  });

export const enrollInCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ slug: z.string().min(1), course_id: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const learner = await resolveLearner(sb, context.userId);

    // Guard duplicate enrollment
    const { data: existing } = await sb
      .from("enrollments")
      .select("id")
      .eq("course_id", data.course_id)
      .eq("learner_id", learner.id)
      .maybeSingle();
    if (existing) throw new Error("Already enrolled in this course");

    const { error } = await sb.from("enrollments").insert({
      tenant_id: tenant.id,
      course_id: data.course_id,
      learner_id: learner.id,
      status: "enrolled",
      enrolled_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateCourseProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        enrollment_id: z.string().uuid(),
        progress_pct: z.number().int().min(0).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    if (!context.userId) throw new Error("Unauthorized");

    const { error: pErr } = await sb.from("course_progress").upsert({
      enrollment_id: data.enrollment_id,
      progress_pct: data.progress_pct,
      last_accessed_at: new Date().toISOString(),
    });
    if (pErr) throw new Error(pErr.message);

    const newStatus =
      data.progress_pct === 100
        ? "completed"
        : data.progress_pct > 0
        ? "in_progress"
        : "enrolled";
    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (data.progress_pct === 100) {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { error: eErr } = await sb
      .from("enrollments")
      .update(updatePayload)
      .eq("id", data.enrollment_id);
    if (eErr) throw new Error(eErr.message);
    return { success: true };
  });

// ---------------------------------------------------------------------------
// Learning Paths
// ---------------------------------------------------------------------------

export const listLearningPaths = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const { data: paths, error } = await sb
      .from("learning_paths")
      .select(
        "*, courses:learning_path_courses(sort_order, course:courses(id, title, duration_minutes, status, content_type))",
      )
      .eq("tenant_id", tenant.id)
      .eq("status", "published")
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return paths ?? [];
  });

export const enrollInPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ slug: z.string().min(1), path_id: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const learner = await resolveLearner(sb, context.userId);

    const { data: existing } = await sb
      .from("path_enrollments")
      .select("id")
      .eq("path_id", data.path_id)
      .eq("learner_id", learner.id)
      .maybeSingle();
    if (existing) throw new Error("Already enrolled in this path");

    const { error } = await sb.from("path_enrollments").insert({
      path_id: data.path_id,
      learner_id: learner.id,
      tenant_id: tenant.id,
      enrolled_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------

export const getMyCertificates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const learner = await resolveLearner(sb, context.userId);

    const { data: certs, error } = await sb
      .from("issued_certificates")
      .select("*, course:courses(title), template:certificate_templates(name)")
      .eq("tenant_id", tenant.id)
      .eq("learner_id", learner.id)
      .order("issued_at", { ascending: false });
    if (error) throw new Error(error.message);
    return certs ?? [];
  });

// ---------------------------------------------------------------------------
// AI Recommendations
// ---------------------------------------------------------------------------

export const getAiRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    const learner = await resolveLearner(sb, context.userId);

    const { data: recs, error } = await sb
      .from("learn_ai_recommendations")
      .select(
        "*, course:courses(id, title, description, duration_minutes, content_type)",
      )
      .eq("tenant_id", tenant.id)
      .eq("learner_id", learner.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    return recs ?? [];
  });

export const dismissRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rec_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    if (!context.userId) throw new Error("Unauthorized");
    const { error } = await sb
      .from("learn_ai_recommendations")
      .update({ status: "dismissed" })
      .eq("id", data.rec_id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ---------------------------------------------------------------------------
// Content Library
// ---------------------------------------------------------------------------

export const getContentLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ slug: z.string().min(1), q: z.string().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const tenant = await resolveTenant(sb, data.slug);
    const roles = await getCallerRoles(sb, context.userId, tenant.id);
    if (roles.length === 0) throw new Error("Forbidden");

    let query = sb
      .from("content_library")
      .select("*")
      .or(`tenant_id.eq.${tenant.id},is_public.eq.true`);

    if (data.q) {
      query = query.ilike("title", `%${data.q}%`);
    }

    const { data: items, error } = await query.order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return items ?? [];
  });
