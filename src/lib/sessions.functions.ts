import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CONTENT_AREAS, MOCK_TOTAL } from "@/lib/exam";

const startInput = z.object({
  mode: z.enum(["practice", "mock", "review"]),
  content_area: z.enum(["human_development","assessment_diagnosis","psychotherapy_interventions","ethics_values"]).optional(),
  length: z.number().int().min(1).max(MOCK_TOTAL).optional(),
});

export const startSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => startInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let qIds: string[] = [];

    if (data.mode === "review") {
      const { data: rq } = await supabase
        .from("review_queue").select("question_id")
        .eq("user_id", userId).lte("due_at", new Date().toISOString())
        .order("due_at", { ascending: true }).limit(50);
      qIds = (rq ?? []).map((r) => r.question_id);
      if (qIds.length === 0) throw new Error("Nothing due for review. Keep practicing!");
    } else if (data.mode === "practice") {
      const len = data.length ?? 10;
      const q = supabase.from("questions").select("id").eq("status", "published").limit(500);
      const { data: pool } = data.content_area ? await q.eq("content_area", data.content_area) : await q;
      qIds = shuffle((pool ?? []).map((r) => r.id)).slice(0, len);
    } else {
      // mock — blueprint-weighted
      const len = data.length ?? MOCK_TOTAL;
      for (const a of CONTENT_AREAS) {
        const n = Math.round((a.blueprintPct / 100) * len);
        const { data: pool } = await supabase.from("questions").select("id").eq("status", "published").eq("content_area", a.key).limit(500);
        qIds.push(...shuffle((pool ?? []).map((r) => r.id)).slice(0, n));
      }
      qIds = shuffle(qIds).slice(0, len);
    }
    if (qIds.length === 0) throw new Error("No questions available yet. Ask an admin to publish questions.");

    const { data: session, error } = await supabase
      .from("study_sessions")
      .insert({ user_id: userId, mode: data.mode, content_area: data.content_area ?? null, total_questions: qIds.length })
      .select("id").single();
    if (error || !session) throw error ?? new Error("Failed to create session");

    // Pre-create response rows in order so we can iterate
    const rows = qIds.map((qid) => ({ session_id: session.id, user_id: userId, question_id: qid }));
    const { error: rErr } = await supabase.from("session_responses").insert(rows);
    if (rErr) throw rErr;

    return { sessionId: session.id, count: qIds.length };
  });

const answerInput = z.object({
  session_id: z.string().uuid(),
  question_id: z.string().uuid(),
  chosen_index: z.number().int().min(0).max(3),
  ms_spent: z.number().int().min(0).optional(),
});

export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => answerInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: q, error: qErr } = await supabase.from("questions")
      .select("correct_index").eq("id", data.question_id).maybeSingle();
    if (qErr || !q) throw qErr ?? new Error("Question not found");
    const isCorrect = q.correct_index === data.chosen_index;

    const { error } = await supabase.from("session_responses")
      .update({ chosen_index: data.chosen_index, is_correct: isCorrect, ms_spent: data.ms_spent ?? null, answered_at: new Date().toISOString() })
      .eq("session_id", data.session_id).eq("question_id", data.question_id).eq("user_id", userId);
    if (error) throw error;

    // spaced repetition update
    if (!isCorrect) {
      await supabase.from("review_queue").upsert({
        user_id: userId, question_id: data.question_id,
        ease: 2.0, interval_days: 1, due_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
        last_reviewed_at: new Date().toISOString(),
      }, { onConflict: "user_id,question_id" });
    } else {
      const { data: existing } = await supabase.from("review_queue")
        .select("ease,interval_days").eq("user_id", userId).eq("question_id", data.question_id).maybeSingle();
      if (existing) {
        const newInterval = Math.max(1, Math.round(existing.interval_days * Number(existing.ease)));
        await supabase.from("review_queue").update({
          interval_days: newInterval,
          due_at: new Date(Date.now() + newInterval * 24 * 3600_000).toISOString(),
          last_reviewed_at: new Date().toISOString(),
        }).eq("user_id", userId).eq("question_id", data.question_id);
      }
    }
    return { isCorrect, correctIndex: q.correct_index };
  });

export const finishSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase.from("session_responses")
      .select("is_correct").eq("session_id", data.session_id).eq("user_id", userId);
    const correct = (rows ?? []).filter((r) => r.is_correct).length;
    const { error } = await supabase.from("study_sessions").update({
      finished_at: new Date().toISOString(), correct_count: correct,
    }).eq("id", data.session_id).eq("user_id", userId);
    if (error) throw error;
    return { correct, total: rows?.length ?? 0 };
  });

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
