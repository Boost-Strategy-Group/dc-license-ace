import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getCourse } from "@/lib/courses.functions";
import { generateNeedsAssessment, listNeedsAssessments } from "@/lib/ai-factory.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/courses/$courseId/needs-assessment")({
  head: () => ({ meta: [{ title: "Needs Assessment · Boost" }] }),
  component: Page,
});

function Page() {
  const { courseId } = Route.useParams();
  const qc = useQueryClient();
  const getC = useServerFn(getCourse);
  const listN = useServerFn(listNeedsAssessments);
  const genFn = useServerFn(generateNeedsAssessment);

  const { data: course } = useQuery({ queryKey: ["course", courseId], queryFn: () => getC({ data: { id: courseId } }) });
  const { data: versions } = useQuery({ queryKey: ["needs", courseId], queryFn: () => listN({ data: { courseId } }) });

  const [form, setForm] = useState({
    industry: "",
    audience: "",
    problem: "",
    desiredOutcomes: "",
    regulatoryContext: "",
  });

  const mut = useMutation({
    mutationFn: () => genFn({ data: { courseId, ...form } }),
    onSuccess: () => {
      toast.success("Needs assessment generated");
      qc.invalidateQueries({ queryKey: ["needs", courseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latest = versions?.[0];
  const latestOutput = (latest?.output ?? {}) as {
    summary?: string;
    industry_analysis?: string;
    audience_profile?: string;
    learning_gap_analysis?: string;
    recommended_outcomes?: string[];
    delivery_recommendations?: string;
  };
  const citations = (latest?.citations ?? []) as Array<{ source?: string; year?: number; topic?: string }>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link to="/admin/courses/$courseId" params={{ courseId }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to course
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold flex items-center gap-2">
          <FileText className="h-7 w-7 text-primary" /> Needs Assessment
        </h1>
        <p className="text-sm text-muted-foreground">{course?.title}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate a new version</CardTitle>
          <CardDescription>IACET requires a documented needs assessment per course.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Industry</Label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Audience</Label><Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Performance gap / problem</Label><Textarea rows={2} value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Desired outcomes</Label><Textarea rows={2} value={form.desiredOutcomes} onChange={(e) => setForm({ ...form, desiredOutcomes: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Regulatory / compliance context (optional)</Label><Textarea rows={2} value={form.regulatoryContext} onChange={(e) => setForm({ ...form, regulatoryContext: e.target.value })} /></div>
          <Button disabled={mut.isPending || !form.industry || !form.audience || !form.problem || !form.desiredOutcomes} onClick={() => mut.mutate()}>
            {mut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate</>}
          </Button>
        </CardContent>
      </Card>

      {latest && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Latest assessment</CardTitle>
              <Badge variant="outline">v{latest.version}</Badge>
            </div>
            <CardDescription>{new Date(latest.created_at).toLocaleString()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {latestOutput.summary && <Section title="Summary" body={latestOutput.summary} />}
            {latestOutput.industry_analysis && <Section title="Industry analysis" body={latestOutput.industry_analysis} />}
            {latestOutput.audience_profile && <Section title="Audience profile" body={latestOutput.audience_profile} />}
            {latestOutput.learning_gap_analysis && <Section title="Learning gap analysis" body={latestOutput.learning_gap_analysis} />}
            {latestOutput.recommended_outcomes?.length ? (
              <div>
                <h3 className="font-medium mb-1">Recommended outcomes</h3>
                <ul className="list-disc pl-5 space-y-1">{latestOutput.recommended_outcomes.map((o, i) => <li key={i}>{o}</li>)}</ul>
              </div>
            ) : null}
            {latestOutput.delivery_recommendations && <Section title="Delivery recommendations" body={latestOutput.delivery_recommendations} />}
            {citations.length > 0 && (
              <div>
                <h3 className="font-medium mb-1">Citations</h3>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  {citations.map((c, i) => <li key={i}>{c.source} ({c.year}) — {c.topic}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {versions && versions.length > 1 && (
        <Card>
          <CardHeader><CardTitle>Version history</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {versions.slice(1).map((v) => (
              <div key={v.id} className="flex justify-between border-b pb-1">
                <span>v{v.version}</span>
                <span className="text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="whitespace-pre-wrap text-muted-foreground">{body}</p>
    </div>
  );
}
