import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import {
  getZoomSignature,
  getTalentLmsLaunchUrl,
  generateHeyGenLesson,
  checkHeyGenStatus,
} from "@/lib/integrations.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Video, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

// =====================================================================
// HeyGen
// =====================================================================

export function HeyGenLessonPlayer({ lessonId, content, isAdmin }: { lessonId: string; content: Record<string, unknown>; isAdmin: boolean }) {
  const videoUrl = content.video_url as string | undefined;
  const status = content.heygen_status as string | undefined;
  const [script, setScript] = useState((content.heygen_script as string | undefined) ?? "");
  const genFn = useServerFn(generateHeyGenLesson);
  const checkFn = useServerFn(checkHeyGenStatus);

  const genMut = useMutation({
    mutationFn: () => genFn({ data: { lessonId, script } }),
    onSuccess: () => toast.success("Generation started. Click Refresh in ~30s."),
    onError: (e: Error) => toast.error(e.message),
  });
  const refMut = useMutation({
    mutationFn: () => checkFn({ data: { lessonId } }),
    onSuccess: (r) => {
      if (r.videoUrl) { toast.success("Video ready — reload the lesson."); window.location.reload(); }
      else toast.info(`Status: ${r.status}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (videoUrl) return <video src={videoUrl} controls className="w-full rounded-md" />;

  return (
    <div className="space-y-3 rounded-md border bg-muted/40 p-4 text-sm">
      <div className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4 text-primary" /> HeyGen avatar lesson</div>
      {isAdmin ? (
        <>
          <p className="text-xs text-muted-foreground">Write the script the avatar will narrate. Generation typically takes 30–90s.</p>
          <Textarea rows={5} value={script} onChange={(e) => setScript(e.target.value)} placeholder="Enter narration script…" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => genMut.mutate()} disabled={genMut.isPending || script.trim().length < 10}>
              {genMut.isPending ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Generating…</> : <><Sparkles className="mr-2 h-3 w-3" /> Generate</>}
            </Button>
            {content.heygen_video_id ? (
              <Button size="sm" variant="outline" onClick={() => refMut.mutate()} disabled={refMut.isPending}>
                <RefreshCw className={`mr-2 h-3 w-3 ${refMut.isPending ? "animate-spin" : ""}`} /> Refresh status {status ? `(${status})` : ""}
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">This lesson is being prepared by your instructor.</p>
      )}
    </div>
  );
}

// =====================================================================
// Zoom — embedded via Zoom Web Meeting SDK
// =====================================================================

declare global {
  interface Window { ZoomMtgEmbedded?: { createClient: () => ZoomEmbeddedClient } }
}
type ZoomEmbeddedClient = {
  init: (opts: { zoomAppRoot: HTMLElement; language: string; patchJsMedia?: boolean }) => Promise<void>;
  join: (opts: { sdkKey: string; signature: string; meetingNumber: string; password?: string; userName: string; userEmail?: string }) => Promise<void>;
};

export function ZoomLessonPlayer({ lessonId: _lessonId, content }: { lessonId: string; content: Record<string, unknown> }) {
  const { user } = useAuth();
  const sigFn = useServerFn(getZoomSignature);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [joining, setJoining] = useState(false);
  const meetingNumber = content.zoom_meeting_number as string | undefined;
  const password = content.zoom_password as string | undefined;
  const joinUrl = content.zoom_join_url as string | undefined;

  async function join() {
    if (!meetingNumber) return;
    setJoining(true);
    try {
      // Load Zoom embedded SDK from CDN at runtime
      if (!window.ZoomMtgEmbedded) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://source.zoom.us/3.8.0/zoom-meeting-embedded-3.8.0.min.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Zoom SDK"));
          document.head.appendChild(s);
        });
      }
      const { signature, sdkKey } = await sigFn({ data: { meetingNumber, role: 0 } });
      const client = window.ZoomMtgEmbedded!.createClient();
      await client.init({ zoomAppRoot: containerRef.current!, language: "en-US", patchJsMedia: true });
      await client.join({
        sdkKey, signature, meetingNumber, password,
        userName: user?.user_metadata?.full_name ?? user?.email ?? "Boost Learner",
        userEmail: user?.email ?? undefined,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setJoining(false);
    }
  }

  if (!meetingNumber) {
    return <div className="rounded-md border bg-muted/40 p-4 text-sm">No Zoom meeting scheduled yet — your instructor will set this up.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Video className="h-4 w-4 text-primary" />
        <span>Meeting {meetingNumber}</span>
        {content.zoom_start_time ? <span className="text-xs text-muted-foreground">· {new Date(content.zoom_start_time as string).toLocaleString()}</span> : null}
      </div>
      <Button onClick={join} disabled={joining}>
        {joining ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Joining…</> : <><Video className="mr-2 h-4 w-4" /> Join in-app</>}
      </Button>
      {joinUrl && (
        <a href={joinUrl} target="_blank" rel="noreferrer" className="ml-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ExternalLink className="h-3 w-3" /> Open in Zoom app
        </a>
      )}
      <div ref={containerRef} className="aspect-video w-full overflow-hidden rounded-md border bg-black" />
    </div>
  );
}

// =====================================================================
// TalentLMS — SSO into a wrapped iframe
// =====================================================================

export function TalentLmsLessonPlayer({ content }: { content: Record<string, unknown> }) {
  const externalCourseId = content.external_course_id as string | undefined;
  const launchFn = useServerFn(getTalentLmsLaunchUrl);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["talentlms", externalCourseId],
    enabled: !!externalCourseId,
    queryFn: () => launchFn({ data: { externalCourseId: externalCourseId! } }),
  });

  useEffect(() => {
    if (error) toast.error((error as Error).message);
  }, [error]);

  if (!externalCourseId) {
    return <div className="rounded-md border bg-muted/40 p-4 text-sm">No TalentLMS course linked. Set <code>content.external_course_id</code> in the builder.</div>;
  }
  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Preparing TalentLMS session…</div>;
  if (!data?.launchUrl) {
    return (
      <div className="rounded-md border bg-muted/40 p-4 text-sm">
        TalentLMS launch unavailable. <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <iframe src={data.launchUrl} className="h-[70vh] w-full rounded-md border" allow="autoplay; fullscreen; clipboard-write" />
      <p className="text-xs text-muted-foreground">Powered by TalentLMS · session embedded in Boost.</p>
    </div>
  );
}
