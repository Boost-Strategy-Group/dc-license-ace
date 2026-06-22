import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCourses, upsertCourse } from "@/lib/courses.functions";
import { listTenants } from "@/lib/tenants.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, BookOpen, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/admin/courses")({
  head: () => ({ meta: [{ title: "Courses · Boost Admin" }] }),
  component: CoursesPage,
});

function CoursesPage() {
  const fn = useServerFn(listCourses);
  const { data, isLoading } = useQuery({ queryKey: ["courses"], queryFn: () => fn({ data: {} }) });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Courses</h1>
          <p className="text-sm text-muted-foreground">Build, sequence, and publish courses for any tenant.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin/ai-factory"><Sparkles className="h-4 w-4" /> AI Course Factory</Link>
          </Button>
          <NewCourseDialog />
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{c.title}</CardTitle>
                <Badge variant={c.status === "published" ? "default" : "outline"}>{c.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">/{c.slug}</div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="line-clamp-2 text-sm text-muted-foreground">{c.description ?? "No description yet."}</p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>{c.contact_hours ?? 0}h</span>
                <span>·</span>
                <span>{c.ceu_value ?? 0} CEU</span>
                <span>·</span>
                <span>{c.dependency_mode}</span>
              </div>
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/admin/courses/$courseId" params={{ courseId: c.id }}>
                  <BookOpen className="h-4 w-4" /> Open builder
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {!isLoading && !data?.length && (
          <p className="col-span-full text-sm text-muted-foreground">No courses yet. Create your first one.</p>
        )}
      </div>
    </div>
  );
}

function NewCourseDialog() {
  const fn = useServerFn(upsertCourse);
  const tenantsFn = useServerFn(listTenants);
  const { data: tenants } = useQuery({ queryKey: ["tenants"], queryFn: () => tenantsFn() });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tenant_id: "",
    slug: "",
    title: "",
    description: "",
    contact_hours: 1,
    ceu_value: 0.1,
    dependency_mode: "sequential" as "open" | "sequential" | "custom",
  });
  const mut = useMutation({
    mutationFn: () => fn({ data: { ...form, status: "draft" } }),
    onSuccess: () => {
      toast.success("Course created");
      qc.invalidateQueries({ queryKey: ["courses"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New course</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create course</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tenant</Label>
            <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}>
              <option value="">Choose tenant…</option>
              {(tenants ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="boost-business-101" /></div>
          <div><Label>Short description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Contact hrs</Label><Input type="number" step="0.5" value={form.contact_hours} onChange={(e) => setForm({ ...form, contact_hours: Number(e.target.value) })} /></div>
            <div><Label>CEU</Label><Input type="number" step="0.1" value={form.ceu_value} onChange={(e) => setForm({ ...form, ceu_value: Number(e.target.value) })} /></div>
            <div>
              <Label>Sequencing</Label>
              <select className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" value={form.dependency_mode} onChange={(e) => setForm({ ...form, dependency_mode: e.target.value as any })}>
                <option value="open">Open</option>
                <option value="sequential">Sequential</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.tenant_id || !form.slug || !form.title}>
            {mut.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
