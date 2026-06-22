import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type Stripe from "stripe";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

type Json = never;
const J = (v: unknown) => v as Json;

function getEnv(name: string): string | null {
  const v = process.env[name];
  return v && v.length > 0 ? v : null;
}

// =====================================================================
// Provider status — surfaced in the admin Integrations page
// =====================================================================

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    stripe: !!(getEnv("STRIPE_SANDBOX_API_KEY") || getEnv("STRIPE_LIVE_API_KEY")),
    stripeLive: !!getEnv("STRIPE_LIVE_API_KEY"),
    heygen: !!getEnv("HEYGEN_API_KEY"),
    zoom: !!(getEnv("ZOOM_SDK_KEY") && getEnv("ZOOM_SDK_SECRET")),
    certifier: !!getEnv("CERTIFIER_API_KEY"),
    talentlms: !!(getEnv("TALENTLMS_API_KEY") && getEnv("TALENTLMS_DOMAIN")),
  }));

// =====================================================================
// Stripe — Embedded Checkout via Lovable managed payments
// =====================================================================

async function resolveOrCreateCustomer(
  stripe: Stripe,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

type CheckoutResult = { clientSecret: string } | { error: string };

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        courseId: z.string().uuid(),
        returnUrl: z.string().url(),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const { data: course, error } = await context.supabase
        .from("courses")
        .select("id, tenant_id, title, description, price_cents, currency, status")
        .eq("id", data.courseId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!course) throw new Error("Course not found");
      if (!course.tenant_id) throw new Error("Course is not assigned to a tenant");
      if (course.status !== "published") throw new Error("Course is not published");
      if (!course.price_cents || course.price_cents <= 0)
        throw new Error("Course is free — enroll directly.");

      const { data: enrollment, error: eErr } = await context.supabase
        .from("enrollments")
        .upsert(
          {
            course_id: course.id,
            tenant_id: course.tenant_id,
            user_id: context.userId,
            status: "pending_payment",
            payment_status: "pending",
            funding_source: "self_pay",
            started_at: new Date().toISOString(),
          },
          { onConflict: "course_id,user_id" },
        )
        .select("id")
        .single();
      if (eErr) throw new Error(eErr.message);

      const stripe = createStripeClient(data.environment);
      const { data: { user } } = await context.supabase.auth.getUser();
      const customerId = await resolveOrCreateCustomer(stripe, {
        email: user?.email ?? undefined,
        userId: context.userId,
      });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: `${data.returnUrl}?session_id={CHECKOUT_SESSION_ID}&course=${course.id}`,
        customer: customerId,
        client_reference_id: enrollment.id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: (course.currency || "usd").toLowerCase(),
              unit_amount: course.price_cents,
              product_data: {
                name: course.title,
                ...(course.description
                  ? { description: course.description.slice(0, 500) }
                  : {}),
                tax_code: "txcd_10000000",
              },
            },
          },
        ],
        payment_intent_data: { description: course.title },
        metadata: {
          enrollment_id: enrollment.id,
          course_id: course.id,
          user_id: context.userId,
        },
        managed_payments: { enabled: true },
      } as Stripe.Checkout.SessionCreateParams);

      await context.supabase
        .from("enrollments")
        .update({ stripe_session_id: session.id ?? null })
        .eq("id", enrollment.id);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

// =====================================================================
// HeyGen — generate avatar narration for a lesson
// =====================================================================

export const generateHeyGenLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      lessonId: z.string().uuid(),
      script: z.string().min(10),
      avatarId: z.string().optional(),
      voiceId: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const key = getEnv("HEYGEN_API_KEY");
    if (!key) throw new Error("HeyGen is not configured. Add HEYGEN_API_KEY.");

    const { data: lesson, error } = await context.supabase
      .from("lessons")
      .select("id, content, kind, module_id")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lesson) throw new Error("Lesson not found");

    const avatarId = data.avatarId || getEnv("HEYGEN_DEFAULT_AVATAR_ID") || "Daisy-inskirt-20220818";
    const voiceId = data.voiceId || getEnv("HEYGEN_DEFAULT_VOICE_ID") || "1bd001e7e50f421d891986aad5158bc8";

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: { "X-Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        video_inputs: [
          {
            character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
            voice: { type: "text", input_text: data.script, voice_id: voiceId },
          },
        ],
        dimension: { width: 1280, height: 720 },
      }),
    });
    const json = (await res.json()) as { data?: { video_id?: string }; message?: string };
    if (!res.ok) throw new Error(json.message ?? "HeyGen error");
    const videoId = json.data?.video_id;
    if (!videoId) throw new Error("HeyGen did not return a video_id");

    const content = { ...(lesson.content as Record<string, unknown> | null ?? {}), heygen_video_id: videoId, heygen_status: "processing", heygen_script: data.script };
    await context.supabase.from("lessons").update({ content: J(content) }).eq("id", lesson.id);

    await context.supabase.from("ai_generations").insert({
      kind: "heygen_video",
      user_id: context.userId,
      model: "heygen",
      input: J({ lessonId: lesson.id, avatarId, voiceId }),
      output: J({ video_id: videoId }),
    });

    return { videoId };
  });

export const checkHeyGenStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ lessonId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const key = getEnv("HEYGEN_API_KEY");
    if (!key) throw new Error("HeyGen is not configured.");

    const { data: lesson } = await context.supabase
      .from("lessons")
      .select("id, content")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson) throw new Error("Lesson not found");
    const c = (lesson.content as Record<string, unknown> | null) ?? {};
    const videoId = c.heygen_video_id as string | undefined;
    if (!videoId) return { status: "none" as const };

    const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: { "X-Api-Key": key },
    });
    const json = (await res.json()) as { data?: { status?: string; video_url?: string; thumbnail_url?: string }; message?: string };
    if (!res.ok) throw new Error(json.message ?? "HeyGen status error");

    const updated: Record<string, unknown> = { ...c, heygen_status: json.data?.status };
    if (json.data?.status === "completed" && json.data.video_url) {
      updated.video_url = json.data.video_url;
      updated.thumbnail_url = json.data.thumbnail_url;
    }
    await context.supabase.from("lessons").update({ content: J(updated) }).eq("id", lesson.id);
    return { status: (json.data?.status ?? "unknown") as string, videoUrl: json.data?.video_url };
  });

// =====================================================================
// Zoom — create meeting + signed JWT for the embedded Web SDK
// =====================================================================

export const createZoomMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ lessonId: z.string().uuid(), topic: z.string(), startTime: z.string() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const accountId = getEnv("ZOOM_ACCOUNT_ID");
    const clientId = getEnv("ZOOM_CLIENT_ID");
    const clientSecret = getEnv("ZOOM_CLIENT_SECRET");
    if (!accountId || !clientId || !clientSecret) {
      throw new Error("Zoom server-to-server OAuth is not configured. Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.");
    }

    const tokenRes = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: "POST",
        headers: { Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`) },
      },
    );
    const tokenJson = (await tokenRes.json()) as { access_token?: string; message?: string };
    if (!tokenRes.ok || !tokenJson.access_token) throw new Error(tokenJson.message ?? "Zoom OAuth failed");

    const mRes = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenJson.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: data.topic,
        type: 2,
        start_time: data.startTime,
        settings: { join_before_host: false, waiting_room: true, approval_type: 2 },
      }),
    });
    const mJson = (await mRes.json()) as { id?: number; password?: string; join_url?: string; message?: string };
    if (!mRes.ok || !mJson.id) throw new Error(mJson.message ?? "Zoom create meeting failed");

    const { data: lesson } = await context.supabase.from("lessons").select("content").eq("id", data.lessonId).maybeSingle();
    const content = { ...((lesson?.content as Record<string, unknown> | null) ?? {}), zoom_meeting_number: String(mJson.id), zoom_password: mJson.password, zoom_join_url: mJson.join_url, zoom_topic: data.topic, zoom_start_time: data.startTime };
    await context.supabase.from("lessons").update({ content: J(content) }).eq("id", data.lessonId);

    return { meetingNumber: String(mJson.id), password: mJson.password, joinUrl: mJson.join_url };
  });

// Web SDK signature (HS256)
export const getZoomSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ meetingNumber: z.string(), role: z.number().min(0).max(1).default(0) }).parse(i))
  .handler(async ({ data }) => {
    const sdkKey = getEnv("ZOOM_SDK_KEY");
    const sdkSecret = getEnv("ZOOM_SDK_SECRET");
    if (!sdkKey || !sdkSecret) throw new Error("Zoom SDK is not configured. Add ZOOM_SDK_KEY and ZOOM_SDK_SECRET.");

    const iat = Math.floor(Date.now() / 1000) - 30;
    const exp = iat + 60 * 60 * 2;
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
      sdkKey,
      mn: data.meetingNumber,
      role: data.role,
      iat,
      exp,
      appKey: sdkKey,
      tokenExp: exp,
    };
    const b64 = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    const unsigned = `${b64(header)}.${b64(payload)}`;
    const { createHmac } = await import("crypto");
    const sig = createHmac("sha256", sdkSecret).update(unsigned).digest("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    return { signature: `${unsigned}.${sig}`, sdkKey, meetingNumber: data.meetingNumber };
  });

// =====================================================================
// TalentLMS — SSO launch URL for an external course
// =====================================================================

export const getTalentLmsLaunchUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ externalCourseId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const apiKey = getEnv("TALENTLMS_API_KEY");
    const domain = getEnv("TALENTLMS_DOMAIN");
    if (!apiKey || !domain) throw new Error("TalentLMS is not configured. Add TALENTLMS_API_KEY and TALENTLMS_DOMAIN.");

    const { data: ext } = await context.supabase
      .from("external_courses")
      .select("id, external_id, metadata")
      .eq("id", data.externalCourseId)
      .maybeSingle();
    if (!ext) throw new Error("External course not found");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: { user } = { user: null } } = await context.supabase.auth.getUser();
    const email = user?.email ?? "";
    const username = (email || `boost-${context.userId.slice(0, 8)}`).replace(/[^a-zA-Z0-9._-]/g, "_");

    const auth = "Basic " + btoa(`${apiKey}:`);
    const base = `https://${domain}/api/v1`;

    // Ensure user exists
    let userId: string | number | null = null;
    const ures = await fetch(`${base}/users/username:${encodeURIComponent(username)}`, { headers: { Authorization: auth } });
    if (ures.ok) {
      const uj = (await ures.json()) as { id?: string | number };
      userId = uj.id ?? null;
    } else {
      const [first, ...rest] = (profile?.full_name ?? username).split(" ");
      const last = rest.join(" ") || "Learner";
      const cres = await fetch(`${base}/users`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: first || "Boost",
          last_name: last,
          email: email || `${username}@boost.local`,
          login: username,
          password: crypto.randomUUID(),
        }),
      });
      const cj = (await cres.json()) as { id?: string | number; error?: { message?: string } };
      if (!cres.ok) throw new Error(cj.error?.message ?? "TalentLMS create user failed");
      userId = cj.id ?? null;
    }
    if (!userId) throw new Error("TalentLMS user id unavailable");

    // Get a one-time SSO/login URL
    const lres = await fetch(`${base}/userlogin`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        login: username,
        course_id: ext.external_id,
        logout_redirect: data.externalCourseId,
      }),
    });
    const lj = (await lres.json()) as { login_key?: string; error?: { message?: string } };
    if (!lres.ok || !lj.login_key) throw new Error(lj.error?.message ?? "TalentLMS login failed");

    return { launchUrl: lj.login_key };
  });

// =====================================================================
// Certifier — issue a credential on course completion
// =====================================================================

export async function issueCertifierForEnrollment(
  supabase: { from: (t: string) => { select: (s: string) => { eq: (k: string, v: unknown) => { maybeSingle: () => Promise<{ data: unknown }> } } } },
  enrollmentId: string,
) {
  const key = getEnv("CERTIFIER_API_KEY");
  if (!key) return { skipped: true as const, reason: "Certifier not configured" };

  const { data: enrRaw } = await supabase.from("enrollments").select("id, user_id, course_id, certifier_credential_id, courses(certifier_group_id, title, ceu_value)").eq("id", enrollmentId).maybeSingle();
  const enr = enrRaw as null | { id: string; user_id: string; course_id: string; certifier_credential_id: string | null; courses: { certifier_group_id: string | null; title: string; ceu_value: number | null } | null };
  if (!enr) return { skipped: true as const, reason: "Enrollment not found" };
  if (enr.certifier_credential_id) return { skipped: true as const, reason: "Already issued" };
  const groupId = enr.courses?.certifier_group_id;
  if (!groupId) return { skipped: true as const, reason: "No certifier_group_id on course" };

  const { data: prof } = await supabase.from("profiles").select("id, full_name").eq("id", enr.user_id).maybeSingle();
  const profile = prof as null | { id: string; full_name: string | null };

  const res = await fetch("https://api.certifier.io/v1/credentials", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      groupId,
      recipient: { name: profile?.full_name ?? "Boost Learner", email: undefined },
      issueDate: new Date().toISOString(),
      customAttributes: { ceus: enr.courses?.ceu_value ?? 0, course: enr.courses?.title ?? "" },
    }),
  });
  const json = (await res.json()) as { id?: string; publicUrl?: string; imageUrl?: string; message?: string };
  if (!res.ok) return { skipped: true as const, reason: json.message ?? "Certifier error" };

  // @ts-expect-error simplified client type
  await supabase.from("enrollments").update({
    certifier_credential_id: json.id ?? null,
    certifier_verify_url: json.publicUrl ?? null,
    certifier_badge_image_url: json.imageUrl ?? null,
  }).eq("id", enrollmentId);

  // @ts-expect-error simplified client type
  await supabase.from("student_vault_items").insert({
    user_id: enr.user_id,
    kind: "certificate",
    title: enr.courses?.title ?? "Certificate",
    source_id: enrollmentId,
    file_url: json.publicUrl ?? null,
    metadata: { badge_image_url: json.imageUrl, credential_id: json.id, ceus: enr.courses?.ceu_value },
  });

  return { issued: true as const, credentialId: json.id, verifyUrl: json.publicUrl };
}

export const issueCertifierCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ enrollmentId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const result = await issueCertifierForEnrollment(context.supabase as never, data.enrollmentId);
    return result;
  });
