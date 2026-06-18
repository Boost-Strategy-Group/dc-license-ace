import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSessionQuestions } from "@/lib/readiness.functions";
import { submitAnswer, finishSession } from "@/lib/sessions.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MOCK_MINUTES, areaShort } from "@/lib/exam";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/session/$id")({
  head: () => ({ meta: [{ title: "Study session · Boost LCSW Readiness" }] }),
  component: SessionRunner,
});

type Item = {
  response_question_id: string;
  chosen_index: number | null;
  is_correct: boolean;
  question: { id: string; content_area: string; sub_topic: string | null; stem: string; choices: string[]; correct_index: number; rationale: string };
};

function SessionRunner() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getQuestions = useServerFn(getSessionQuestions);
  const submit = useServerFn(submitAnswer);
  const finish = useServerFn(finishSession);

  const { data, isLoading, error } = useQuery({
    queryKey: ["session", id],
    queryFn: () => getQuestions({ data: { session_id: id } }),
  });

  const items: Item[] = useMemo(() => (data?.items ?? []) as Item[], [data]);
  const isMock = data?.session.mode === "mock";
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);

  // Track answered state from server (for resume)
  useEffect(() => {
    if (!items.length) return;
    const firstUnanswered = items.findIndex((i) => i.chosen_index == null);
    setIdx(firstUnanswered === -1 ? items.length - 1 : firstUnanswered);
  }, [items.length]);

  useEffect(() => { startedAt.current = Date.now(); setPicked(null); setRevealed(false); }, [idx]);

  // Mock timer
  const [secondsLeft, setSecondsLeft] = useState(MOCK_MINUTES * 60);
  useEffect(() => {
    if (!isMock) return;
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [isMock]);
  useEffect(() => { if (isMock && secondsLeft === 0 && !done) handleFinish(); /* eslint-disable-next-line */ }, [secondsLeft, isMock]);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading session…</div>;
  if (error || !data) return <div className="text-sm text-destructive">{(error as Error)?.message ?? "Session not found"}</div>;

  if (done && score) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader><CardTitle className="font-display text-2xl">Session complete</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="font-display text-6xl font-semibold text-primary">{pct}%</div>
            <p className="text-muted-foreground">{score.correct} of {score.total} correct{isMock ? " — projected ASWB-style scaled performance" : ""}.</p>
            <div className="flex gap-2">
              <Link to="/dashboard"><Button>Back to dashboard</Button></Link>
              <Link to="/practice"><Button variant="outline">More practice</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const item = items[idx];
  if (!item) return null;
  const progress = ((idx + 1) / items.length) * 100;

  async function handlePick(i: number) {
    if (revealed) return;
    setPicked(i);
    if (isMock) return; // mock: no reveal until end
    setSubmitting(true);
    try {
      await submit({ data: { session_id: id, question_id: item.question.id, chosen_index: i, ms_spent: Date.now() - startedAt.current } });
      setRevealed(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  async function handleNext() {
    if (isMock && picked != null) {
      // commit mock answer silently
      try {
        await submit({ data: { session_id: id, question_id: item.question.id, chosen_index: picked, ms_spent: Date.now() - startedAt.current } });
      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); return; }
    }
    if (idx + 1 < items.length) setIdx(idx + 1);
    else handleFinish();
  }

  async function handleFinish() {
    setSubmitting(true);
    try {
      const res = await finish({ data: { session_id: id } });
      setScore({ correct: res.correct, total: res.total });
      setDone(true);
      qc.invalidateQueries({ queryKey: ["readiness"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{areaShort(item.question.content_area)}{item.question.sub_topic ? ` · ${item.question.sub_topic}` : ""}</span>
        <div className="flex items-center gap-4">
          <span className="tabular-nums">{idx + 1} / {items.length}</span>
          {isMock && <span className="rounded-md bg-warning/20 px-2 py-1 font-mono text-warning-foreground">{formatTime(secondsLeft)}</span>}
        </div>
      </div>
      <Progress value={progress} className="mb-6" />

      <Card>
        <CardHeader><CardTitle className="font-display text-lg leading-relaxed">{item.question.stem}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {item.question.choices.map((c, i) => {
            const isCorrect = revealed && i === item.question.correct_index;
            const isWrong = revealed && i === picked && i !== item.question.correct_index;
            return (
              <button
                key={i}
                onClick={() => handlePick(i)}
                disabled={revealed || submitting}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition",
                  picked === i && !revealed && "border-primary bg-primary/5",
                  isCorrect && "border-success bg-success/10",
                  isWrong && "border-destructive bg-destructive/10",
                  !revealed && "hover:bg-muted",
                )}
              >
                <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-medium", picked === i && !revealed && "border-primary text-primary", isCorrect && "border-success text-success", isWrong && "border-destructive text-destructive")}>{String.fromCharCode(65 + i)}</span>
                <span className="flex-1">{c}</span>
                {isCorrect && <Check className="h-5 w-5 text-success" />}
                {isWrong && <X className="h-5 w-5 text-destructive" />}
              </button>
            );
          })}
          {revealed && (
            <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
              <div className="text-sm font-semibold">Rationale</div>
              <p className="mt-1 text-sm text-muted-foreground">{item.question.rationale}</p>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            {!isMock && !revealed && <Button variant="ghost" onClick={() => { setRevealed(true); /* skip */ }}>Skip</Button>}
            <Button onClick={handleNext} disabled={submitting || (isMock ? picked == null : !revealed && picked == null)}>
              {idx + 1 < items.length ? "Next" : "Finish"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
