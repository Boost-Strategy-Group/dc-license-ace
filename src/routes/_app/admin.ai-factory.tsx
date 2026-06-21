import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listTenants } from "@/lib/tenants.functions";
import { generateCourseFromAi } from "@/lib/ai-factory.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/ai-factory")({
  head: () => ({ meta: [{ title: "AI Course Factory · Boost" }] }),
  component: AiFactoryPage,
});

function AiFactoryPage() {
  const navigate = useNavigate();
  const listT = useServerFn(listTenants);
  const genFn = useServerFn(generateCourseFromAi);
  const { data: tenants } = useQuery({ queryKey: ["tenants"], queryFn: () => listT() });

  const [form, setForm] = useState({
    tenantId: "",
    title: "",
    audience: "",
    industry: "",
    objectives: "",
    outcomes: "",
    certificationType: "",
    durationHours: 4,
  });

  const mut = useMutation({
    mutationFn: () => genFn({ data: form }),
    onSuccess: (res) => {
      toast.success("Course generated");
      navigate({ to: "/admin/courses/$courseId", params: { courseId: res.courseId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ready =
    form.tenantId && form.title && form.audience && form.industry && form.objectives && form.outcomes && form.durationHours > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/admin/courses" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Courses
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" /> AI Course Factory
        </h1>
        <p className="text-sm text-muted-foreground">
          Give the factory a brief and it scaffolds a draft course — description, Bloom-leveled objectives, modules &
          lessons, a final exam, plus pre/post surveys. Review and refine in the builder before publishing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course brief</CardTitle>
          <CardDescription>The more specific you are, the better the draft.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select value={form.tenantId} onValueChange={(v) => setForm((f) => ({ ...f, tenantId: v }))}>
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
                value={form.durationHours}
                onChange={(e) => setForm((f) => ({ ...f, durationHours: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Course title</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. AI Adoption for Small Business Founders" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} placeholder="e.g. Professional services" />
            </div>
            <div className="space-y-2">
              <Label>Certification type</Label>
              <Input value={form.certificationType} onChange={(e) => setForm((f) => ({ ...f, certificationType: e.target.value }))} placeholder="IACET CEU / Certificate / none" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Target audience</Label>
            <Textarea rows={2} value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))} placeholder="Who is this for? Role, experience, context." />
          </div>
          <div className="space-y-2">
            <Label>Stated objectives</Label>
            <Textarea rows={3} value={form.objectives} onChange={(e) => setForm((f) => ({ ...f, objectives: e.target.value }))} placeholder="What should learners be able to do?" />
          </div>
          <div className="space-y-2">
            <Label>Desired outcomes</Label>
            <Textarea rows={3} value={form.outcomes} onChange={(e) => setForm((f) => ({ ...f, outcomes: e.target.value }))} placeholder="Business / performance outcomes after completion." />
          </div>
          <Button disabled={!ready || mut.isPending} onClick={() => mut.mutate()} className="w-full">
            {mut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate course draft</>}
          </Button>
          <p className="text-xs text-muted-foreground">
            Generation typically takes 15–45 seconds. You can edit everything afterward.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
