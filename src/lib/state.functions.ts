import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Eligibility ----------

const screeningInput = z.object({
  tenantId: z.string().uuid(),
  courseId: z.string().uuid().optional().nullable(),
  unemployed: z.boolean(),
  underemployed: z.boolean(),
  publicAssistance: z.boolean(),
});

export const submitEligibilityScreening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => screeningInput.parse(input))
  .handler(async ({ data, context }) => {
    const qualified = data.unemployed || data.underemployed || data.publicAssistance;
    const { data: row, error } = await context.supabase
      .from("eligibility_screenings")
      .insert({
        user_id: context.userId,
        tenant_id: data.tenantId,
        course_id: data.courseId ?? null,
        unemployed: data.unemployed,
        underemployed: data.underemployed,
        public_assistance: data.publicAssistance,
        qualified,
      })
      .select("id, qualified, tenant_id, course_id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyScreenings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("eligibility_screenings")
      .select("id, tenant_id, course_id, unemployed, underemployed, public_assistance, qualified, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAllScreenings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("eligibility_screenings")
      .select("id, user_id, tenant_id, course_id, qualified, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Vouchers ----------

export const listVouchers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tenantId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("state_vouchers")
      .select("id, code, tenant_id, course_id, status, redeemed_by, redeemed_at, notes, created_at")
      .order("created_at", { ascending: false });
    if (data.tenantId) q = q.eq("tenant_id", data.tenantId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tenantId: z.string().uuid(),
        courseId: z.string().uuid().optional().nullable(),
        code: z.string().min(4).max(40),
        notes: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("state_vouchers")
      .insert({
        tenant_id: data.tenantId,
        course_id: data.courseId ?? null,
        code: data.code.toUpperCase(),
        status: "issued",
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const redeemVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(4) }).parse(input))
  .handler(async ({ data, context }) => {
    const code = data.code.toUpperCase();
    const { data: voucher, error: vErr } = await context.supabase
      .from("state_vouchers")
      .select("id, status, redeemed_by")
      .eq("code", code)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!voucher) throw new Error("Voucher not found");
    if (voucher.status === "redeemed") throw new Error("Voucher already redeemed");

    const { data: row, error } = await context.supabase
      .from("state_vouchers")
      .update({
        status: "redeemed",
        redeemed_by: context.userId,
        redeemed_at: new Date().toISOString(),
      })
      .eq("id", voucher.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const voidVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("state_vouchers")
      .update({ status: "void" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Appointments (scheduler) ----------

export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("state_appointments")
      .select("id, eligibility_id, scheduled_at, status, created_at, updated_at")
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const scheduleAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        eligibilityId: z.string().uuid(),
        scheduledAt: z.string().datetime(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("state_appointments")
      .insert({
        eligibility_id: data.eligibilityId,
        scheduled_at: data.scheduledAt,
        status: "scheduled",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["scheduled", "completed", "no_show", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("state_appointments")
      .update({ status: data.status })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- Authorizations queue ----------

export const listAuthorizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("state_authorizations")
      .select("id, tenant_id, state_code, occupation, etpl_status, funding_notes, created_at")
      .order("state_code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        tenantId: z.string().uuid(),
        stateCode: z.string().min(2).max(4),
        occupation: z.string().min(1),
        etplStatus: z.string().optional().nullable(),
        fundingNotes: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const row = {
      id: data.id,
      tenant_id: data.tenantId,
      state_code: data.stateCode.toUpperCase(),
      occupation: data.occupation,
      etpl_status: data.etplStatus ?? null,
      funding_notes: data.fundingNotes ?? null,
    };
    const { data: out, error } = await context.supabase
      .from("state_authorizations")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

export const deleteAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("state_authorizations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
