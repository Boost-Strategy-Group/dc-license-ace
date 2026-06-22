import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listTenants } from "@/lib/tenants.functions";
import { draftCourseFromAi, createCourseFromPlan, type CoursePlan, type FactoryBrief } from "@/lib/ai-factory.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowLeft, Loader2, Check, RefreshCw, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/ai-factory")({
  head: () => ({ meta: [{ title: "AI Course Factory · Boost" }] }),
  component: AiFactoryPage,
});

type Brief = Omit<FactoryBrief, "refinementNotes"> & { refinementNotes: string };

const EMPTY_BRIEF: Brief = {
  tenantId: "",
  title: "",
  audience: "",
  industry: "",
  objectives: "",
  outcomes: "",
  certificationType: "",
  durationHours: 4,
  refinementNotes: "",
};

function AiFactoryPage() {
  const navigate = useNavigate();
  const listT = useServerFn(listTenants);
  const draftFn = useServerFn(draftCourseFromAi);
  const createFn = useServerFn(createCourseFromPlan);
  const { data: tenants } = useQuery({ queryKey: ["tenants"], queryFn: () => listT() });

  const [brief, setBrief] = useState<Brief>(EMPTY_BRIEF);
  const [plan, setPlan] = useState<CoursePlan | null>(null);

  const draftMut = useMutation({
    mutationFn: () => draftFn({ data: brief }),
    onSuccess: (res) => {
      setPlan(res.plan);
      toast.success("Draft ready — review and approve below");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { input: brief, plan: plan! } }),
    onSuccess: (res) => {
      toast.success("Course created");
      navigate({ to: "/admin/courses/$courseId", params: { courseId: res.courseId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ready =
    brief.tenantId && brief.title && brief.audience && brief.industry && brief.objectives && brief.outcomes && brief.durationHours > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link to="/admin/courses" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Courses
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" /> AI Course Factory
        </h1>
        <p className="text-sm text-muted-foreground">
          Give the factory a brief and it drafts a course outline — description, objectives, modules &amp; lessons, a
          final exam, plus pre/post surveys. Review and approve before anything is saved.
        </p>
      </div>

      {!plan && (
        <Card>
          <CardHeader>
            <CardTitle>Course brief</CardTitle>
            <CardDescription>The more specific you are, the better the draft.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tenant</Label>
                <Select value={brief.tenantId} onValueChange={(v) => setBrief((f) => ({ ...f, tenantId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                  <SelectContent>
                    {(tenants ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration (contact hours)</Label>
                <Input
                  type="number" step="0.5" min={0.5}
                  value={brief.durationHours}
                  onChange={(e) => setBrief((f) => ({ ...f, durationHours: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Course title</Label>
              <Input value={brief.title} onChange={(e) => setBrief((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. AI Adoption for Small Business Founders" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input value={brief.industry} onChange={(e) => setBrief((f) => ({ ...f, industry: e.target.value }))} placeholder="e.g. Professional services" />
              </div>
              <div className="space-y-2">
                <Label>Certification type</Label>
                <Input value={brief.certificationType} onChange={(e) => setBrief((f) => ({ ...f, certificationType: e.target.value }))} placeholder="IACET CEU / Certificate / none" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Target audience</Label>
              <Textarea rows={2} value={brief.audience} onChange={(e) => setBrief((f) => ({ ...f, audience: e.target.value }))} placeholder="Who is this for? Role, experience, context." />
            </div>
            <div className="space-y-2">
              <Label>Stated objectives</Label>
              <Textarea rows={3} value={brief.objectives} onChange={(e) => setBrief((f) => ({ ...f, objectives: e.target.value }))} placeholder="What should learners be able to do?" />
            </div>
            <div className="space-y-2">
              <Label>Desired outcomes</Label>
              <Textarea rows={3} value={brief.outcomes} onChange={(e) => setBrief((f) => ({ ...f, outcomes: e.target.value }))} placeholder="Business / performance outcomes after completion." />
            </div>
            <Button disabled={!ready || draftMut.isPending} onClick={() => draftMut.mutate()} className="w-full">
              {draftMut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Drafting outline…</> : <><Sparkles className="mr-2 h-4 w-4" /> Draft course outline</>}
            </Button>
            <p className="text-xs text-muted-foreground">
              Drafting typically takes 15–45 seconds. Nothing is saved until you approve the draft on the next step.
            </p>
          </CardContent>
        </Card>
      )}

      {plan && (
        <ReviewPanel
          plan={plan}
          brief={brief}
          onChangePlan={setPlan}
          onChangeBrief={setBrief}
          onRegenerate={() => draftMut.mutate()}
          regenerating={draftMut.isPending}
          onApprove={() => createMut.mutate()}
          approving={createMut.isPending}
          onCancel={() => {
            setPlan(null);
            setBrief((b) => ({ ...b, refinementNotes: "" }));
          }}
        />
      )}
    </div>
  );
}

function ReviewPanel({
  plan, brief, onChangePlan, onChangeBrief, onRegenerate, regenerating, onApprove, approving, onCancel,
}: {
  plan: CoursePlan;
  brief: Brief;
  onChangePlan: (p: CoursePlan) => void;
  onChangeBrief: (updater: (b: Brief) => Brief) => void;
  onRegenerate: () => void;
  regenerating: boolean;
  onApprove: () => void;
  approving: boolean;
  onCancel: () => void;
}) {
  const setPlan = (patch: Partial<CoursePlan>) => onChangePlan({ ...plan, ...patch });

  return (
    <div className="space-y-4">
      <Card className="border-primary/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Review draft for "{brief.title}"
              </CardTitle>
              <CardDescription>Edit anything below. Nothing is saved until you approve.</CardDescription>
            </div>
            <Badge variant="outline">Draft</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Course description</Label>
            <Textarea rows={4} value={plan.description} onChange={(e) => setPlan({ description: e.target.value })} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>CEU value</Label>
              <Input type="number" step="0.1" value={plan.ceu_value}
                onChange={(e) => setPlan({ ceu_value: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Final exam pass threshold (%)</Label>
              <Input type="number" min={0} max={100} value={plan.final_quiz.pass_threshold}
                onChange={(e) => setPlan({ final_quiz: { ...plan.final_quiz, pass_threshold: Number(e.target.value) } })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Learning objectives ({plan.learning_objectives.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {plan.learning_objectives.map((lo, i) => (
            <div key={i} className="flex items-start gap-2">
              <Input className="w-32" value={lo.bloom_verb}
                onChange={(e) => {
                  const next = [...plan.learning_objectives];
                  next[i] = { ...lo, bloom_verb: e.target.value };
                  setPlan({ learning_objectives: next });
                }} />
              <Textarea rows={2} value={lo.text}
                onChange={(e) => {
                  const next = [...plan.learning_objectives];
                  next[i] = { ...lo, text: e.target.value };
                  setPlan({ learning_objectives: next });
                }} />
              <Button variant="ghost" size="icon" onClick={() => {
                const next = plan.learning_objectives.filter((_, idx) => idx !== i);
                setPlan({ learning_objectives: next });
              }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() =>
            setPlan({ learning_objectives: [...plan.learning_objectives, { text: "", bloom_verb: "Understand" }] })}>
            Add objective
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modules &amp; lessons ({plan.modules.length} modules)</CardTitle>
          <CardDescription>Edit titles, summaries, lesson kinds, or remove items.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.modules.map((m, mi) => (
            <div key={mi} className="rounded-md border p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <Input value={m.title}
                    onChange={(e) => {
                      const next = [...plan.modules];
                      next[mi] = { ...m, title: e.target.value };
                      setPlan({ modules: next });
                    }} />
                  <Textarea rows={2} placeholder="Module summary" value={m.summary}
                    onChange={(e) => {
                      const next = [...plan.modules];
                      next[mi] = { ...m, summary: e.target.value };
                      setPlan({ modules: next });
                    }} />
                </div>
                <Button variant="ghost" size="icon" onClick={() => {
                  const next = plan.modules.filter((_, idx) => idx !== mi);
                  setPlan({ modules: next });
                }}><Trash2 className="h-4 w-4" /></Button>
              </div>

              <div className="space-y-1 pl-2 border-l-2 border-muted">
                {m.lessons.map((l, li) => (
                  <div key={li} className="flex items-center gap-2">
                    <Input className="flex-1" value={l.title}
                      onChange={(e) => {
                        const next = [...plan.modules];
                        const lns = [...m.lessons];
                        lns[li] = { ...l, title: e.target.value };
                        next[mi] = { ...m, lessons: lns };
                        setPlan({ modules: next });
                      }} />
                    <select className="rounded-md border bg-background px-2 py-1 text-xs"
                      value={l.kind}
                      onChange={(e) => {
                        const next = [...plan.modules];
                        const lns = [...m.lessons];
                        lns[li] = { ...l, kind: e.target.value };
                        next[mi] = { ...m, lessons: lns };
                        setPlan({ modules: next });
                      }}>
                      {["video", "text", "activity", "quiz", "file"].map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <Input className="w-20" type="number" placeholder="min" value={l.duration_minutes ?? ""}
                      onChange={(e) => {
                        const next = [...plan.modules];
                        const lns = [...m.lessons];
                        lns[li] = { ...l, duration_minutes: e.target.value ? Number(e.target.value) : null };
                        next[mi] = { ...m, lessons: lns };
                        setPlan({ modules: next });
                      }} />
                    <Button variant="ghost" size="icon" onClick={() => {
                      const next = [...plan.modules];
                      next[mi] = { ...m, lessons: m.lessons.filter((_, idx) => idx !== li) };
                      setPlan({ modules: next });
                    }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => {
                  const next = [...plan.modules];
                  next[mi] = { ...m, lessons: [...m.lessons, { title: "New lesson", kind: "text", summary: "", duration_minutes: 10 }] };
                  setPlan({ modules: next });
                }}>+ Add lesson</Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() =>
            setPlan({ modules: [...plan.modules, { title: "New module", summary: "", lessons: [] }] })}>
            Add module
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Final exam ({plan.final_quiz.items.length} items)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {plan.final_quiz.items.map((q, qi) => (
            <div key={qi} className="rounded-md border p-3 space-y-2">
              <Textarea rows={2} value={q.stem}
                onChange={(e) => {
                  const items = [...plan.final_quiz.items];
                  items[qi] = { ...q, stem: e.target.value };
                  setPlan({ final_quiz: { ...plan.final_quiz, items } });
                }} />
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${qi}`} checked={q.answer_index === oi}
                    onChange={() => {
                      const items = [...plan.final_quiz.items];
                      items[qi] = { ...q, answer_index: oi };
                      setPlan({ final_quiz: { ...plan.final_quiz, items } });
                    }} />
                  <Input value={opt}
                    onChange={(e) => {
                      const items = [...plan.final_quiz.items];
                      const opts = [...q.options];
                      opts[oi] = e.target.value;
                      items[qi] = { ...q, options: opts };
                      setPlan({ final_quiz: { ...plan.final_quiz, items } });
                    }} />
                </div>
              ))}
              <Input placeholder="Rationale" value={q.rationale}
                onChange={(e) => {
                  const items = [...plan.final_quiz.items];
                  items[qi] = { ...q, rationale: e.target.value };
                  setPlan({ final_quiz: { ...plan.final_quiz, items } });
                }} />
              <Button variant="ghost" size="sm" onClick={() => {
                const items = plan.final_quiz.items.filter((_, idx) => idx !== qi);
                setPlan({ final_quiz: { ...plan.final_quiz, items } });
              }}><Trash2 className="mr-1 h-3 w-3" /> Remove item</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pre &amp; post surveys</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Pre-course survey prompt</Label>
            <Textarea rows={3} value={plan.pre_survey_prompt ?? ""}
              onChange={(e) => setPlan({ pre_survey_prompt: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Post-course survey prompt</Label>
            <Textarea rows={3} value={plan.post_survey_prompt ?? ""}
              onChange={(e) => setPlan({ post_survey_prompt: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Refine &amp; regenerate</CardTitle>
          <CardDescription>Optional: tell the AI what to change, then regenerate.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={2} placeholder="e.g. Make it 6 modules, add more practical activities, focus on Tier 1 suppliers."
            value={brief.refinementNotes}
            onChange={(e) => onChangeBrief((b) => ({ ...b, refinementNotes: e.target.value }))} />
          <Button variant="outline" disabled={regenerating} onClick={onRegenerate}>
            {regenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Regenerating…</> : <><RefreshCw className="mr-2 h-4 w-4" /> Regenerate draft</>}
          </Button>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-2 rounded-md border bg-background/95 p-3 shadow-md backdrop-blur">
        <Button variant="ghost" onClick={onCancel} disabled={approving}>
          <X className="mr-1 h-4 w-4" /> Discard draft
        </Button>
        <Button onClick={onApprove} disabled={approving}>
          {approving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating course…</> : <><Check className="mr-2 h-4 w-4" /> Approve &amp; create course</>}
        </Button>
      </div>
    </div>
  );
}
