import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getCourse,
  listModules,
  listLessons,
  upsertModule,
  deleteModule,
  upsertLesson,
  deleteLesson,
  upsertCourse,
} from "@/lib/courses.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, FileText, Video, ClipboardCheck, Sparkles, FileQuestion } from "lucide-react";
import { ObjectivesPanel, AssessmentsPanel, SurveysPanel, ReadinessPanel } from "@/components/course-builder-panels";

export const Route = createFileRoute("/_app/admin/courses/$courseId")({
  head: () => ({ meta: [{ title: "Course Builder · Boost" }] }),
  component: BuilderPage,
});

const LESSON_KINDS = [
  { value: "video", label: "Video", icon: Video },
  { value: "text", label: "Text/Reading", icon: FileText },
  { value: "file", label: "Download", icon: FileText },
  { value: "quiz", label: "Quiz", icon: ClipboardCheck },
  { value: "activity", label: "Activity", icon: FileQuestion },
  { value: "exam", label: "Final exam", icon: ClipboardCheck },
  { value: "heygen", label: "HeyGen avatar", icon: Sparkles },
  { value: "zoom_live", label: "Zoom live", icon: Video },
  { value: "talentlms", label: "TalentLMS embed", icon: FileText },
];

function BuilderPage() {
  const { courseId } = Route.useParams();
  const getC = useServerFn(getCourse);
  const listM = useServerFn(listModules);
  const listL = useServerFn(listLessons);
  const upsertC = useServerFn(upsertCourse);
  const qc = useQueryClient();

  const { data: course } = useQuery({ queryKey: ["course", courseId], queryFn: () => getC({ data: { id: courseId } }) });
  const { data: modules } = useQuery({ queryKey: ["modules", courseId], queryFn: () => listM({ data: { courseId } }) });
  const { data: lessons } = useQuery({ queryKey: ["lessons", courseId], queryFn: () => listL({ data: { courseId } }) });

  const publishMut = useMutation({
    mutationFn: (status: "draft" | "published") =>
      upsertC({ data: { id: courseId, tenant_id: course!.tenant_id, slug: course!.slug, title: course!.title, status } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      qc.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!course) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link to="/admin/courses" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All courses
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">{course.title}</h1>
            <p className="text-sm text-muted-foreground">{course.description ?? "No description yet."}</p>
            <div className="mt-2 flex gap-2 text-xs">
              <Badge variant={course.status === "published" ? "default" : "outline"}>{course.status}</Badge>
              <Badge variant="outline">{course.dependency_mode}</Badge>
              <Badge variant="outline">{course.contact_hours ?? 0}h · {course.ceu_value ?? 0} CEU</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/courses/$courseId/needs-assessment" params={{ courseId }}>
              <Button variant="outline"><FileText className="mr-2 h-4 w-4" /> Needs Assessment</Button>
            </Link>
            {course.status !== "published" ? (
              <Button onClick={() => publishMut.mutate("published")} disabled={publishMut.isPending}>Publish</Button>
            ) : (
              <Button variant="outline" onClick={() => publishMut.mutate("draft")} disabled={publishMut.isPending}>Unpublish</Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Modules & Lessons</CardTitle>
              <NewModuleButton courseId={courseId} order={(modules?.length ?? 0) + 1} />
            </CardHeader>
            <CardContent className="space-y-4">
              {(modules ?? []).map((m: any) => (
                <ModuleBlock
                  key={m.id}
                  module={m}
                  lessons={(lessons ?? []).filter((l: any) => l.module_id === m.id)}
                />
              ))}
              {!modules?.length && <p className="text-sm text-muted-foreground">No modules yet — add the first one to start structuring your course.</p>}
            </CardContent>
          </Card>
          <ObjectivesPanel courseId={courseId} />
          <AssessmentsPanel courseId={courseId} />
          <SurveysPanel courseId={courseId} />
        </div>
        <aside className="space-y-6">
          <ReadinessPanel courseId={courseId} />
        </aside>
      </div>
    </div>
  );
}

function NewModuleButton({ courseId, order }: { courseId: string; order: number }) {
  const fn = useServerFn(upsertModule);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", summary: "" });
  const mut = useMutation({
    mutationFn: () => fn({ data: { course_id: courseId, title: form.title, summary: form.summary, sort_order: order } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modules", courseId] });
      setOpen(false);
      setForm({ title: "", summary: "" });
      toast.success("Module added");
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Module</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New module</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Summary</Label><Textarea rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={!form.title || mut.isPending}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModuleBlock({ module, lessons }: { module: any; lessons: any[] }) {
  const delFn = useServerFn(deleteModule);
  const qc = useQueryClient();
  const delMut = useMutation({
    mutationFn: () => delFn({ data: { id: module.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modules", module.course_id] });
      qc.invalidateQueries({ queryKey: ["lessons", module.course_id] });
      toast.success("Module removed");
    },
  });
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{module.sort_order}. {module.title}</div>
          {module.summary && <div className="text-xs text-muted-foreground">{module.summary}</div>}
        </div>
        <div className="flex gap-1">
          <NewLessonButton moduleId={module.id} courseId={module.course_id} order={(lessons.length) + 1} />
          <Button size="icon" variant="ghost" onClick={() => delMut.mutate()}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      {!!lessons.length && (
        <ul className="mt-3 space-y-1">
          {lessons.map((l) => <LessonRow key={l.id} lesson={l} />)}
        </ul>
      )}
    </div>
  );
}

function LessonRow({ lesson }: { lesson: any }) {
  const fn = useServerFn(deleteLesson);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => fn({ data: { id: lesson.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lessons"] }),
  });
  const kind = LESSON_KINDS.find((k) => k.value === lesson.kind);
  const Icon = kind?.icon ?? FileText;
  return (
    <li className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{lesson.title}</span>
        <Badge variant="outline" className="text-[10px]">{kind?.label ?? lesson.kind}</Badge>
        {lesson.duration_minutes ? <span className="text-xs text-muted-foreground">{lesson.duration_minutes}m</span> : null}
      </div>
      <Button size="icon" variant="ghost" onClick={() => mut.mutate()}><Trash2 className="h-3.5 w-3.5" /></Button>
    </li>
  );
}

function NewLessonButton({ moduleId, courseId, order }: { moduleId: string; courseId: string; order: number }) {
  const fn = useServerFn(upsertLesson);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    kind: "text" as (typeof LESSON_KINDS)[number]["value"],
    body: "",
    url: "",
    assessment_id: "",
    duration_minutes: 5,
  });
  const isQuiz = form.kind === "quiz" || form.kind === "exam";
  const isText = form.kind === "text";
  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          module_id: moduleId,
          title: form.title,
          kind: form.kind,
          duration_minutes: form.duration_minutes,
          sort_order: order,
          content: isQuiz
            ? { assessment_id: form.assessment_id }
            : isText
              ? { body: form.body }
              : { url: form.url },
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lessons", courseId] });
      setOpen(false);
      setForm({ title: "", kind: "text", body: "", url: "", assessment_id: "", duration_minutes: 5 });
      toast.success("Lesson added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" /> Lesson</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add lesson</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div>
            <Label>Type</Label>
            <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as any })}>
              {LESSON_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          {isQuiz ? (
            <div><Label>Assessment ID</Label><Input value={form.assessment_id} onChange={(e) => setForm({ ...form, assessment_id: e.target.value })} placeholder="UUID from Assessments panel" /></div>
          ) : isText ? (
            <div><Label>Body (markdown ok)</Label><Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          ) : (
            <div><Label>URL or reference</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder={form.kind === "video" ? "https://… mp4 / youtube" : "https://…"} /></div>
          )}
          <div><Label>Duration (minutes)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={!form.title || mut.isPending}>Add lesson</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
