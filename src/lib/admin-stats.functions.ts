import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CONTENT_AREAS } from "@/lib/exam";

async function requireAdmin(context: { supabase: { rpc: (...args: unknown[]) => unknown }; userId: string }) {
  const rpc = context.supabase.rpc as unknown as (n: string, a: object) => Promise<{ data: boolean | null; error: unknown }>;
  const { data, error } = await rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw error;
  if (!data) throw new Error("Admin access required.");
}

export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data: profiles, error } = await context.supabase
      .from("profiles").select("id, full_name, cohort, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const ids = (profiles ?? []).map((p) => p.id);
    if (ids.length === 0) return [];

    const { data: sessions } = await context.supabase.from("study_sessions")
      .select("user_id, correct_count, total_questions, mode, finished_at")
      .in("user_id", ids).not("finished_at", "is", null);

    const agg = new Map<string, { attempted: number; correct: number; lastActive: string | null; mocks: number }>();
    for (const s of sessions ?? []) {
      const cur = agg.get(s.user_id) ?? { attempted: 0, correct: 0, lastActive: null, mocks: 0 };
      cur.attempted += s.total_questions;
      cur.correct += s.correct_count;
      if (!cur.lastActive || (s.finished_at && s.finished_at > cur.lastActive)) cur.lastActive = s.finished_at;
      if (s.mode === "mock") cur.mocks += 1;
      agg.set(s.user_id, cur);
    }
    return (profiles ?? []).map((p) => {
      const a = agg.get(p.id) ?? { attempted: 0, correct: 0, lastActive: null, mocks: 0 };
      return { ...p, attempted: a.attempted, accuracy: a.attempted ? Math.round((a.correct / a.attempted) * 100) : null, lastActive: a.lastActive, mocks: a.mocks };
    });
  });

export const cohortAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data: responses } = await context.supabase
      .from("session_responses")
      .select("is_correct, question_id, questions(content_area, stem)")
      .not("chosen_index", "is", null);

    const perArea: Record<string, { total: number; correct: number }> = {};
    for (const a of CONTENT_AREAS) perArea[a.key] = { total: 0, correct: 0 };
    const perQ = new Map<string, { stem: string; total: number; correct: number }>();

    for (const r of (responses ?? []) as Array<{ is_correct: boolean; question_id: string; questions: { content_area: string; stem: string } | null }>) {
      if (!r.questions) continue;
      const area = r.questions.content_area;
      if (perArea[area]) {
        perArea[area].total += 1;
        if (r.is_correct) perArea[area].correct += 1;
      }
      const q = perQ.get(r.question_id) ?? { stem: r.questions.stem, total: 0, correct: 0 };
      q.total += 1;
      if (r.is_correct) q.correct += 1;
      perQ.set(r.question_id, q);
    }

    const byArea = CONTENT_AREAS.map((a) => {
      const p = perArea[a.key];
      return { area: a.key, label: a.label, short: a.short, attempted: p.total, accuracy: p.total ? Math.round((p.correct / p.total) * 100) : null };
    });

    const hardest = [...perQ.entries()]
      .filter(([, v]) => v.total >= 3)
      .map(([id, v]) => ({ id, stem: v.stem, total: v.total, accuracy: Math.round((v.correct / v.total) * 100) }))
      .sort((a, b) => a.accuracy - b.accuracy).slice(0, 8);

    const { count: students } = await context.supabase.from("profiles").select("id", { count: "exact", head: true });
    const { count: questions } = await context.supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", "published");

    return { byArea, hardest, students: students ?? 0, questions: questions ?? 0 };
  });
