import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCoursePlayer, markLessonComplete } from "@/lib/courses.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle, Lock, Video, FileText, ClipboardCheck, Sparkles, FileQuestion } from "lucide-react";

export const Route = createFileRoute("/_app/learn/$courseId")({
  head: () => ({ meta: [{ title: "Course Player · Boost" }] }),
  component: PlayerPage,
});

const KIND_ICON: Record<string, any> = {
  video: Video, text: FileText, file: FileText, quiz: ClipboardCheck,
  activity: FileQuestion, exam: ClipboardCheck, heygen: Sparkles, zoom_live: Video, talentlms: FileText,
};

function PlayerPage() {
  const { courseId } = Route.useParams();
  const fn = useServerFn(getCoursePlayer);
  const markFn = useServerFn(markLessonComplete);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["player", courseId], queryFn: () => fn({ data: { courseId } }) });

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  const flatLessons = useMemo(() => {
    if (!data?.course) return [];
    const mods = ((data.course as any).modules ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order);
    return mods.flatMap((m: any) => (m.lessons ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((l: any) => ({ ...l, moduleTitle: m.title, moduleOrder: m.sort_order })));
  }, [data]);

  const completedIds = new Set((data?.progress ?? []).filter((p: any) => p.status === "complete").map((p: any) => p.lesson_id));
  const activeLesson = flatLessons.find((l: any) => l.id === activeLessonId) ?? flatLessons.find((l: any) => !completedIds.has(l.id)) ?? flatLessons[0];

  const sequential = data?.course?.dependency_mode === "sequential";

  const isLocked = (lessonId: string) => {
    if (!sequential) return false;
    const idx = flatLessons.findIndex((l: any) => l.id === lessonId);
    if (idx <= 0) return false;
    return !completedIds.has(flatLessons[idx - 1].id);
  };

  const completeMut = useMutation({
    mutationFn: (lessonId: string) => markFn({ data: { enrollmentId: data!.enrollment!.id, lessonId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["player", courseId] });
      toast.success("Marked complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.course) return <p className="text-sm text-muted-foreground">Course not found.</p>;
  if (!data.enrollment) {
    return (
      <div className="mx-auto max-w-xl space-y-3 text-center">
        <p className="text-sm text-muted-foreground">You are not enrolled in this course.</p>
        <Link to="/catalog"><Button>Browse catalog</Button></Link>
      </div>
    );
  }

  const pct = flatLessons.length ? Math.round((completedIds.size / flatLessons.length) * 100) : 0;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Dashboard
        </Link>
        <div>
          <h1 className="font-display text-xl font-semibold">{data.course.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{completedIds.size} of {flatLessons.length} complete</p>
          <Progress value={pct} className="mt-2 h-2" />
        </div>
        <nav className="space-y-1">
          {flatLessons.map((l: any) => {
            const Icon = KIND_ICON[l.kind] ?? FileText;
            const done = completedIds.has(l.id);
            const locked = isLocked(l.id);
            const active = activeLesson?.id === l.id;
            return (
              <button
                key={l.id}
                onClick={() => !locked && setActiveLessonId(l.id)}
                disabled={locked}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"} ${locked ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : locked ? <Lock className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{l.title}</span>
              </button>
            );
          })}
          {!flatLessons.length && <p className="text-xs text-muted-foreground">This course has no lessons yet.</p>}
        </nav>
      </aside>

      <main>
        {activeLesson ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Module {activeLesson.moduleOrder} · {activeLesson.moduleTitle}</div>
                  <CardTitle className="text-xl">{activeLesson.title}</CardTitle>
                </div>
                <Badge variant="outline">{activeLesson.kind}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <LessonViewer lesson={activeLesson} />
              {!completedIds.has(activeLesson.id) && (
                <Button onClick={() => completeMut.mutate(activeLesson.id)} disabled={completeMut.isPending}>
                  Mark complete
                </Button>
              )}
              {completedIds.has(activeLesson.id) && <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>}
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">No lessons yet.</p>
        )}
      </main>
    </div>
  );
}

function LessonViewer({ lesson }: { lesson: any }) {
  const c = lesson.content ?? {};
  if (lesson.kind === "text") {
    return <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">{c.body ?? "No content."}</div>;
  }
  if (lesson.kind === "video" && c.url) {
    const isYT = /youtube\.com|youtu\.be/.test(c.url);
    if (isYT) {
      const id = c.url.match(/(?:v=|youtu\.be\/)([^&]+)/)?.[1];
      return <div className="aspect-video"><iframe className="h-full w-full rounded-md" src={`https://www.youtube.com/embed/${id}`} allowFullScreen /></div>;
    }
    return <video src={c.url} controls className="w-full rounded-md" />;
  }
  if (lesson.kind === "file" && c.url) {
    return <a href={c.url} target="_blank" rel="noreferrer" className="text-primary underline">Download / open material</a>;
  }
  if (lesson.kind === "zoom_live") {
    return <div className="rounded-md border bg-muted/40 p-4 text-sm">Embedded Zoom session — coming in Phase D.</div>;
  }
  if (lesson.kind === "heygen") {
    return <div className="rounded-md border bg-muted/40 p-4 text-sm">HeyGen-narrated lesson — generation engine wired in Phase D.</div>;
  }
  if (lesson.kind === "talentlms") {
    return <div className="rounded-md border bg-muted/40 p-4 text-sm">TalentLMS embed — SSO wrapper added in Phase D.</div>;
  }
  if (lesson.kind === "quiz" || lesson.kind === "exam") {
    return <div className="rounded-md border bg-muted/40 p-4 text-sm">Assessment authoring & grading lands in Phase B.2 (next iteration).</div>;
  }
  if (lesson.kind === "activity") {
    return <div className="rounded-md border bg-muted/40 p-4 text-sm">Activity prompts feed the AI Work Product Engine — Phase C.</div>;
  }
  return <p className="text-sm text-muted-foreground">No preview for this lesson type.</p>;
}
