import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAssessmentWithItems, submitAssessment } from "@/lib/assessments.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

export function QuizRunner({
  assessmentId,
  enrollmentId,
  lessonId,
}: {
  assessmentId: string;
  enrollmentId: string;
  lessonId: string;
}) {
  const getFn = useServerFn(getAssessmentWithItems);
  const submitFn = useServerFn(submitAssessment);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["quiz", assessmentId], queryFn: () => getFn({ data: { id: assessmentId } }) });
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean; correctCount: number; total: number } | null>(null);

  const mut = useMutation({
    mutationFn: () => submitFn({ data: { assessmentId, enrollmentId, lessonId, answers } }),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["player"] });
      if (r.passed) toast.success(`Passed · ${r.score}%`); else toast.warning(`Score ${r.score}% — try again`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return <p className="text-sm text-muted-foreground">Loading quiz…</p>;
  if (!data.items.length) return <p className="text-sm text-muted-foreground">No questions yet.</p>;

  if (result) {
    return (
      <div className="space-y-3 rounded-md border bg-muted/30 p-4">
        <div className="flex items-center gap-2">
          <Badge className={result.passed ? "bg-green-600" : "bg-amber-500"}>{result.passed ? "Passed" : "Try again"}</Badge>
          <span className="text-sm">Score {result.score}% ({result.correctCount}/{result.total})</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setResult(null); setAnswers({}); }}>Retake</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {data.items.map((it: any, idx: number) => (
        <div key={it.id} className="rounded-md border bg-card p-4">
          <div className="mb-2 text-sm font-medium">{idx + 1}. {it.stem}</div>
          {it.item_type === "true_false" && (
            <div className="flex gap-3">
              {["true", "false"].map((v) => (
                <label key={v} className="flex items-center gap-1 text-sm">
                  <input type="radio" name={it.id} checked={answers[it.id] === v} onChange={() => setAnswers({ ...answers, [it.id]: v })} /> {v}
                </label>
              ))}
            </div>
          )}
          {it.item_type === "mcq" && Array.isArray(it.choices) && (
            <div className="space-y-1">
              {it.choices.map((c: string, i: number) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <input type="radio" name={it.id} checked={answers[it.id] === c} onChange={() => setAnswers({ ...answers, [it.id]: c })} /> {c}
                </label>
              ))}
            </div>
          )}
          {it.item_type === "multi" && Array.isArray(it.choices) && (
            <div className="space-y-1">
              {it.choices.map((c: string, i: number) => {
                const arr: string[] = Array.isArray(answers[it.id]) ? answers[it.id] : [];
                const checked = arr.includes(c);
                return (
                  <label key={i} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={checked} onChange={(e) => {
                      const next = new Set(arr);
                      if (e.target.checked) next.add(c); else next.delete(c);
                      setAnswers({ ...answers, [it.id]: Array.from(next) });
                    }} /> {c}
                  </label>
                );
              })}
            </div>
          )}
          {it.item_type === "short_answer" && (
            <div>
              <Label className="text-xs text-muted-foreground">Your answer (manually graded)</Label>
              <Textarea rows={3} value={answers[it.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [it.id]: e.target.value })} />
            </div>
          )}
        </div>
      ))}
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Submit</Button>
    </div>
  );
}
