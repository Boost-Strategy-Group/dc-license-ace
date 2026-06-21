import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAssessmentAdmin, upsertAssessmentItem, deleteAssessmentItem } from "@/lib/assessments.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/admin/courses/$courseId/assessments/$assessmentId")({
  head: () => ({ meta: [{ title: "Assessment Items · Boost" }] }),
  component: ItemsPage,
});

function ItemsPage() {
  const { courseId, assessmentId } = Route.useParams();
  const getFn = useServerFn(getAssessmentAdmin);
  const { data } = useQuery({ queryKey: ["assessment-admin", assessmentId], queryFn: () => getFn({ data: { id: assessmentId } }) });

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/admin/courses/$courseId" params={{ courseId }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to course
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold">{data.title}</h1>
        <div className="mt-1 flex gap-2 text-xs">
          <Badge variant="outline">{data.kind}</Badge>
          <Badge variant="outline">Pass ≥ {data.pass_threshold}%</Badge>
          <Badge variant="outline">{data.items.length} items</Badge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Lesson reference: <code className="rounded bg-muted px-1.5 py-0.5">{`{ "assessment_id": "${assessmentId}" }`}</code> in the lesson's content.</p>
      </div>

      <div className="space-y-3">
        {data.items.map((item: any, idx: number) => <ItemRow key={item.id} item={item} idx={idx + 1} />)}
      </div>

      <NewItemCard assessmentId={assessmentId} nextOrder={(data.items.length ?? 0) + 1} />
    </div>
  );
}

function ItemRow({ item, idx }: { item: any; idx: number }) {
  const delFn = useServerFn(deleteAssessmentItem);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => delFn({ data: { id: item.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessment-admin"] }),
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <CardTitle className="text-sm">{idx}. {item.stem}</CardTitle>
        <Button size="icon" variant="ghost" onClick={() => mut.mutate()}><Trash2 className="h-3.5 w-3.5" /></Button>
      </CardHeader>
      <CardContent className="space-y-1 text-xs text-muted-foreground">
        <div><Badge variant="outline" className="text-[10px]">{item.item_type}</Badge></div>
        {Array.isArray(item.choices) && (
          <ul className="list-disc pl-4">
            {item.choices.map((c: any, i: number) => {
              const correct = item.item_type === "multi"
                ? Array.isArray(item.correct) && item.correct.includes(c)
                : String(item.correct) === String(c);
              return <li key={i} className={correct ? "text-green-600 font-medium" : ""}>{c}{correct ? " ✓" : ""}</li>;
            })}
          </ul>
        )}
        {item.item_type === "true_false" && <div>Correct: <span className="font-medium text-green-600">{String(item.correct)}</span></div>}
        {item.rationale && <div className="italic">Rationale: {item.rationale}</div>}
      </CardContent>
    </Card>
  );
}

function NewItemCard({ assessmentId, nextOrder }: { assessmentId: string; nextOrder: number }) {
  const fn = useServerFn(upsertAssessmentItem);
  const qc = useQueryClient();
  const [type, setType] = useState<"mcq" | "multi" | "true_false" | "short_answer">("mcq");
  const [stem, setStem] = useState("");
  const [choices, setChoices] = useState<string[]>(["", "", "", ""]);
  const [correct, setCorrect] = useState<string | string[]>("");
  const [rationale, setRationale] = useState("");

  const reset = () => { setStem(""); setChoices(["", "", "", ""]); setCorrect(""); setRationale(""); };

  const mut = useMutation({
    mutationFn: () => {
      const cleanChoices = choices.filter(Boolean);
      let correctVal: any = correct;
      if (type === "true_false") correctVal = correct;
      if (type === "short_answer") correctVal = null;
      return fn({ data: { assessment_id: assessmentId, item_type: type, stem, choices: type === "short_answer" || type === "true_false" ? null : cleanChoices, correct: correctVal, rationale, sort_order: nextOrder } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assessment-admin"] }); reset(); toast.success("Item added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> New item</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Type</Label>
          <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={type} onChange={(e) => { setType(e.target.value as any); setCorrect(e.target.value === "multi" ? [] : ""); }}>
            <option value="mcq">Multiple choice (single answer)</option>
            <option value="multi">Multiple choice (multi-select)</option>
            <option value="true_false">True / False</option>
            <option value="short_answer">Short answer (manual grade)</option>
          </select>
        </div>
        <div><Label>Question stem</Label><Textarea rows={2} value={stem} onChange={(e) => setStem(e.target.value)} /></div>

        {type === "true_false" && (
          <div>
            <Label>Correct answer</Label>
            <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={String(correct)} onChange={(e) => setCorrect(e.target.value)}>
              <option value="">—</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </div>
        )}

        {(type === "mcq" || type === "multi") && (
          <div className="space-y-2">
            <Label>Choices (mark correct)</Label>
            {choices.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                {type === "mcq" ? (
                  <input type="radio" name="correct" checked={correct === c && !!c} onChange={() => setCorrect(c)} />
                ) : (
                  <input type="checkbox" checked={Array.isArray(correct) && correct.includes(c) && !!c} onChange={(e) => {
                    const arr = Array.isArray(correct) ? [...correct] : [];
                    if (e.target.checked) arr.push(c); else arr.splice(arr.indexOf(c), 1);
                    setCorrect(arr);
                  }} />
                )}
                <Input value={c} onChange={(e) => { const next = [...choices]; next[i] = e.target.value; setChoices(next); }} placeholder={`Choice ${i + 1}`} />
              </div>
            ))}
          </div>
        )}

        <div><Label>Rationale (shown after submission)</Label><Textarea rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} /></div>
        <Button onClick={() => mut.mutate()} disabled={!stem || mut.isPending}>Add item</Button>
      </CardContent>
    </Card>
  );
}
