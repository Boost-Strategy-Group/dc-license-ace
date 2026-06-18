import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CONTENT_AREAS } from "@/lib/exam";

export const getReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: responses } = await supabase
      .from("session_responses")
      .select("is_correct, chosen_index, question_id, questions(content_area)")
      .eq("user_id", userId)
      .not("chosen_index", "is", null);

    const perArea: Record<string, { total: number; correct: number }> = {};
    for (const a of CONTENT_AREAS) perArea[a.key] = { total: 0, correct: 0 };
    let total = 0, correct = 0;
    for (const r of responses ?? []) {
      const area = (r as { questions: { content_area: string } | null }).questions?.content_area;
      if (!area || !(area in perArea)) continue;
      perArea[area].total += 1;
      total += 1;
      if (r.is_correct) { perArea[area].correct += 1; correct += 1; }
    }
    const overall = total ? Math.round((correct / total) * 100) : 0;
    const byArea = CONTENT_AREAS.map((a) => {
      const p = perArea[a.key];
      return { area: a.key, label: a.label, short: a.short, attempted: p.total, accuracy: p.total ? Math.round((p.correct / p.total) * 100) : null };
    });

    const { data: lastSessions } = await supabase.from("study_sessions")
      .select("id, mode, content_area, total_questions, correct_count, started_at, finished_at")
      .eq("user_id", userId).not("finished_at", "is", null)
      .order("started_at", { ascending: false }).limit(5);

    const { count: dueCount } = await supabase.from("review_queue")
      .select("id", { count: "exact", head: true }).eq("user_id", userId).lte("due_at", new Date().toISOString());

    return { overall, total, byArea, lastSessions: lastSessions ?? [], dueCount: dueCount ?? 0 };
  });

export const getSessionQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session, error: sErr } = await supabase.from("study_sessions")
      .select("id, mode, total_questions, started_at, finished_at, content_area")
      .eq("id", data.session_id).eq("user_id", userId).maybeSingle();
    if (sErr || !session) throw sErr ?? new Error("Session not found");

    const { data: rows } = await supabase.from("session_responses")
      .select("question_id, chosen_index, is_correct, questions(id, content_area, sub_topic, stem, choices, correct_index, rationale)")
      .eq("session_id", data.session_id).eq("user_id", userId).order("id");

    type Row = { question_id: string; chosen_index: number | null; is_correct: boolean; questions: { id: string; content_area: string; sub_topic: string | null; stem: string; choices: unknown; correct_index: number; rationale: string } | null };
    const items = ((rows ?? []) as Row[]).filter((r) => r.questions).map((r) => ({
      response_question_id: r.question_id,
      chosen_index: r.chosen_index,
      is_correct: r.is_correct,
      question: { ...r.questions!, choices: r.questions!.choices as string[] },
    }));
    return { session, items };
  });
