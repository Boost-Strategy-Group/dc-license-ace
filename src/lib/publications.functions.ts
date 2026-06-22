import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PublicationRow = {
  id: string;
  course_id: string;
  target_type: string;
  target_id: string | null;
  source: string;
  status: string;
  published_at: string;
  published_by: string | null;
};

export const listPublications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ courseId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("course_publications")
      .select(
        "id, course_id, target_type, target_id, source, status, published_at, published_by, course:courses(id, title, slug, status)",
      )
      .order("published_at", { ascending: false });
    if (data.courseId) q = q.eq("course_id", data.courseId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const tenantIds = Array.from(
      new Set((rows ?? []).filter((r) => r.target_type === "tenant" && r.target_id).map((r) => r.target_id as string)),
    );
    let tenantMap: Record<string, { id: string; name: string; slug: string }> = {};
    if (tenantIds.length) {
      const { data: tns } = await context.supabase
        .from("tenants")
        .select("id, name, slug")
        .in("id", tenantIds);
      tenantMap = Object.fromEntries((tns ?? []).map((t) => [t.id, t]));
    }
    return (rows ?? []).map((r) => ({
      ...r,
      tenant: r.target_type === "tenant" && r.target_id ? tenantMap[r.target_id] ?? null : null,
    }));
  });

export const publishCourseToTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        courseId: z.string().uuid(),
        tenantId: z.string().uuid(),
        source: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (!isSuper) throw new Error("Only super admins can publish courses to tenants");

    // Upsert by (course_id, target_type, target_id)
    const { data: existing } = await context.supabase
      .from("course_publications")
      .select("id")
      .eq("course_id", data.courseId)
      .eq("target_type", "tenant")
      .eq("target_id", data.tenantId)
      .maybeSingle();

    if (existing) {
      const { data: row, error } = await context.supabase
        .from("course_publications")
        .update({ status: "published", published_at: new Date().toISOString(), published_by: context.userId })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }

    const { data: row, error } = await context.supabase
      .from("course_publications")
      .insert({
        course_id: data.courseId,
        target_type: "tenant",
        target_id: data.tenantId,
        source: data.source ?? "boost_factory",
        status: "published",
        published_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const unpublishCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (!isSuper) throw new Error("Only super admins can unpublish");
    const { error } = await context.supabase.from("course_publications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Returns courses currently published to any tenant the user belongs to.
 * Used by Boost!Learn module home for tenant-scoped catalog.
 */
export const listTenantPublishedCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: memberships, error: mErr } = await context.supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", context.userId);
    if (mErr) throw new Error(mErr.message);
    const tenantIds = (memberships ?? []).map((m) => m.tenant_id);
    if (!tenantIds.length) return [];

    const { data, error } = await context.supabase
      .from("course_publications")
      .select(
        "id, published_at, target_id, source, course:courses(id, title, slug, description, cover_image_url, contact_hours, ceu_value, status), tenant:tenants!course_publications_target_id_fkey(id, name, slug, brand_primary, logo_url)",
      )
      .eq("target_type", "tenant")
      .eq("status", "published")
      .in("target_id", tenantIds)
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });
