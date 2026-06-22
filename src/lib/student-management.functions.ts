import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StudentRow = {
  member_id: string;
  user_id: string;
  full_name: string | null;
  role: string;
  created_at: string;
  module_ids: string[];
};

// List learners (members) of a tenant plus their assigned Boost! module IDs.
export const listTenantStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ tenantId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<StudentRow[]> => {
    const { data: members, error } = await context.supabase
      .from("tenant_members")
      .select("id, user_id, role, created_at, profiles:profiles(full_name)")
      .eq("tenant_id", data.tenantId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const memberIds = (members ?? []).map((m: any) => m.id as string);
    let assignments: Record<string, string[]> = {};
    if (memberIds.length > 0) {
      const { data: links, error: linkErr } = await context.supabase
        .from("tenant_member_modules")
        .select("tenant_member_id, boost_module_id")
        .in("tenant_member_id", memberIds);
      if (linkErr) throw new Error(linkErr.message);
      for (const l of links ?? []) {
        const k = l.tenant_member_id as string;
        (assignments[k] ??= []).push(l.boost_module_id as string);
      }
    }

    return (members ?? []).map((m: any) => ({
      member_id: m.id as string,
      user_id: m.user_id as string,
      full_name: (m.profiles?.full_name as string | null) ?? null,
      role: m.role as string,
      created_at: m.created_at as string,
      module_ids: assignments[m.id as string] ?? [],
    }));
  });

// Set the complete set of module assignments for a student.
export const setStudentModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      memberId: z.string().uuid(),
      moduleIds: z.array(z.string().uuid()),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    // Authorize: caller must be super_admin or tenant_admin of the member's tenant
    const { data: member, error: mErr } = await context.supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member) throw new Error("Member not found");

    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    const { data: isAdmin } = await context.supabase.rpc("has_tenant_role", {
      _tenant_id: member.tenant_id,
      _user_id: context.userId,
      _role: "tenant_admin",
    });
    if (!isSuper && !isAdmin) throw new Error("Forbidden");

    // Replace assignments: delete missing, upsert provided
    const { error: delErr } = await context.supabase
      .from("tenant_member_modules")
      .delete()
      .eq("tenant_member_id", data.memberId);
    if (delErr) throw new Error(delErr.message);

    if (data.moduleIds.length > 0) {
      const rows = data.moduleIds.map((boost_module_id) => ({
        tenant_member_id: data.memberId,
        boost_module_id,
        assigned_by: context.userId,
      }));
      const { error: insErr } = await context.supabase
        .from("tenant_member_modules")
        .insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    return { ok: true };
  });
