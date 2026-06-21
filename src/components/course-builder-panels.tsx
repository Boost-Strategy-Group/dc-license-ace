import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listObjectives,
  upsertObjective,
  deleteObjective,
  listAssessments,
  upsertAssessment,
  deleteAssessment,
  listSurveys,
  upsertSurvey,
  deleteSurvey,
  getCourseReadiness,
} from "@/lib/assessments.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, AlertCircle, ListChecks, ClipboardCheck, MessageSquare } from "lucide-react";

const BLOOM = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

export function ObjectivesPanel({ courseId }: { courseId: string }) {
  const listFn = useServerFn(listObjectives);
  const upFn = useServerFn(upsertObjective);
  const delFn = useServerFn(deleteObjective);
  const qc = useQueryClient();
  const { data: rows } = useQuery({ queryKey: ["objectives", courseId], queryFn: () => listFn({ data: { courseId } }) });
  const [text, setText] = useState("");
  const [verb, setVerb] = useState("Apply");

  const addMut = useMutation({
    mutationFn: () => upFn({ data: { course_id: courseId, text, bloom_verb: verb, sort_order: (rows?.length ?? 0) + 1 } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["objectives", courseId] }); setText(""); },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["objectives", courseId] }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" /> Learning Objectives (IACET)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1">
          {(rows ?? []).map((o: any) => (
            <li key={o.id} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
              <span><Badge variant="outline" className="mr-2 text-[10px]">{o.bloom_verb}</Badge>{o.text}</span>
              <Button size="icon" variant="ghost" onClick={() => delMut.mutate(o.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </li>
          ))}
          {!rows?.length && <p className="text-xs text-muted-foreground">Add at least 3 measurable objectives.</p>}
        </ul>
        <div className="flex gap-2">
          <select className="rounded-md border border-input bg-background px-2 py-2 text-sm" value={verb} onChange={(e) => setVerb(e.target.value)}>
            {BLOOM.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <Input placeholder="Learners will…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button onClick={() => addMut.mutate()} disabled={!text || addMut.isPending}>Add</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AssessmentsPanel({ courseId }: { courseId: string }) {
  const listFn = useServerFn(listAssessments);
  const upFn = useServerFn(upsertAssessment);
  const delFn = useServerFn(deleteAssessment);
  const qc = useQueryClient();
  const { data: rows } = useQuery({ queryKey: ["assessments", courseId], queryFn: () => listFn({ data: { courseId } }) });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", kind: "quiz" as "quiz" | "final_exam", pass_threshold: 70 });

  const addMut = useMutation({
    mutationFn: () => upFn({ data: { course_id: courseId, title: form.title, kind: form.kind, pass_threshold: form.pass_threshold } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assessments", courseId] }); setOpen(false); setForm({ title: "", kind: "quiz", pass_threshold: 70 }); },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments", courseId] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Assessments</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Assessment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New assessment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div>
                <Label>Kind</Label>
                <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as any })}>
                  <option value="quiz">Module quiz</option>
                  <option value="final_exam">Final exam</option>
                </select>
              </div>
              <div><Label>Pass threshold (%)</Label><Input type="number" value={form.pass_threshold} onChange={(e) => setForm({ ...form, pass_threshold: Number(e.target.value) })} /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => addMut.mutate()} disabled={!form.title || addMut.isPending}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {(rows ?? []).map((a: any) => (
          <div key={a.id} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            <div>
              <span className="font-medium">{a.title}</span>
              <Badge variant="outline" className="ml-2 text-[10px]">{a.kind}</Badge>
              <span className="ml-2 text-xs text-muted-foreground">Pass ≥ {a.pass_threshold}%</span>
            </div>
            <div className="flex gap-1">
              <Link to="/admin/courses/$courseId/assessments/$assessmentId" params={{ courseId, assessmentId: a.id }}>
                <Button size="sm" variant="outline">Edit items</Button>
              </Link>
              <Button size="icon" variant="ghost" onClick={() => delMut.mutate(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
        {!rows?.length && <p className="text-xs text-muted-foreground">No assessments yet. Attach to a lesson of type "quiz" / "exam" via its content.assessment_id.</p>}
      </CardContent>
    </Card>
  );
}

export function SurveysPanel({ courseId }: { courseId: string }) {
  const listFn = useServerFn(listSurveys);
  const upFn = useServerFn(upsertSurvey);
  const delFn = useServerFn(deleteSurvey);
  const qc = useQueryClient();
  const { data: rows } = useQuery({ queryKey: ["surveys", courseId], queryFn: () => listFn({ data: { courseId } }) });

  const upMut = useMutation({
    mutationFn: (vars: { kind: "pre" | "post"; title: string }) =>
      upFn({ data: { course_id: courseId, kind: vars.kind, title: vars.title, schema: { questions: defaultSurveyQuestions(vars.kind) } } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["surveys", courseId] }); toast.success("Survey configured"); },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surveys", courseId] }),
  });

  const pre = rows?.find((r: any) => r.kind === "pre");
  const post = rows?.find((r: any) => r.kind === "post");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Pre / Post Surveys (ungraded)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(["pre", "post"] as const).map((kind) => {
          const existing = kind === "pre" ? pre : post;
          return (
            <div key={kind} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
              <div>
                <span className="font-medium capitalize">{kind}-course survey</span>
                {existing ? <Badge className="ml-2">Configured</Badge> : <Badge variant="outline" className="ml-2">Not configured</Badge>}
                {existing && <span className="ml-2 text-xs text-muted-foreground">{(existing.schema as any)?.questions?.length ?? 0} questions</span>}
              </div>
              {existing ? (
                <Button size="icon" variant="ghost" onClick={() => delMut.mutate(existing.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              ) : (
                <Button size="sm" onClick={() => upMut.mutate({ kind, title: kind === "pre" ? "Pre-course survey" : "Post-course evaluation" })}>
                  Configure
                </Button>
              )}
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">Default templates use Likert + open-ended items. Custom schema editor lands in Phase F reporting.</p>
      </CardContent>
    </Card>
  );
}

function defaultSurveyQuestions(kind: "pre" | "post") {
  if (kind === "pre") return [
    { id: "confidence", type: "likert", text: "How confident are you in this subject right now?", scale: 5 },
    { id: "experience", type: "short", text: "Briefly describe your current experience." },
    { id: "goals", type: "short", text: "What outcome do you want from this course?" },
  ];
  return [
    { id: "confidence", type: "likert", text: "How confident are you now compared to when you started?", scale: 5 },
    { id: "objectives_met", type: "likert", text: "The course met its stated learning objectives.", scale: 5 },
    { id: "instructor", type: "likert", text: "The instructor was effective.", scale: 5 },
    { id: "nps", type: "nps", text: "How likely are you to recommend this course?" },
    { id: "comments", type: "short", text: "Anything you'd improve?" },
  ];
}

export function ReadinessPanel({ courseId }: { courseId: string }) {
  const fn = useServerFn(getCourseReadiness);
  const { data } = useQuery({ queryKey: ["readiness", courseId], queryFn: () => fn({ data: { courseId } }) });
  if (!data) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {data.ready ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
          IACET Publish Readiness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {data.checks.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              {c.ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
              <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
