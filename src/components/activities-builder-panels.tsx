import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listActivities,
  upsertActivity,
  listWorkProducts,
  upsertWorkProduct,
} from "@/lib/ai-factory.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, FileQuestion, FileText, Copy } from "lucide-react";

type Field = { key: string; label: string; type: "text" | "textarea" | "number"; required?: boolean; placeholder?: string };

export function WorkProductsPanel({ courseId }: { courseId: string }) {
  const listFn = useServerFn(listWorkProducts);
  const upFn = useServerFn(upsertWorkProduct);
  const qc = useQueryClient();
  const { data: rows } = useQuery({ queryKey: ["work-products", courseId], queryFn: () => listFn({ data: { courseId } }) });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", kind: "business_plan", templateText: "" });

  const mut = useMutation({
    mutationFn: () => {
      const template = form.templateText.trim()
        ? { sections: form.templateText.split("\n").map((s) => s.trim()).filter(Boolean) }
        : {};
      return upFn({ data: { course_id: courseId, title: form.title, kind: form.kind, template } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-products", courseId] });
      setOpen(false); setForm({ title: "", kind: "business_plan", templateText: "" });
      toast.success("Work product saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Work products</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1"><Plus className="h-3 w-3" /> Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New work product template</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Business Plan" /></div>
              <div className="space-y-1.5">
                <Label>Kind</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  <option value="business_plan">Business plan</option>
                  <option value="sop">SOP</option>
                  <option value="capability_statement">Capability statement</option>
                  <option value="strategic_plan">Strategic plan</option>
                  <option value="ai_adoption_plan">AI adoption plan</option>
                  <option value="founder_dependency_report">Founder dependency report</option>
                  <option value="pitch_deck">Pitch deck draft</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Template sections (one per line)</Label>
                <Textarea rows={6} value={form.templateText} onChange={(e) => setForm({ ...form, templateText: e.target.value })} placeholder={"Executive Summary\nMarket Analysis\nCustomer Profile\nMarketing Strategy\nFinancial Plan"} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => mut.mutate()} disabled={!form.title || mut.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {(rows ?? []).map((wp) => (
          <div key={wp.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <div>
              <div className="font-medium">{wp.title}</div>
              <div className="text-xs text-muted-foreground">{wp.kind} · id <code className="text-[10px]">{wp.id.slice(0, 8)}</code></div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(wp.id); toast.success("Work product id copied"); }}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {!rows?.length && <p className="text-xs text-muted-foreground">No work product templates yet. Activities use these to generate learner deliverables.</p>}
      </CardContent>
    </Card>
  );
}

export function ActivitiesPanel({ courseId }: { courseId: string }) {
  const listFn = useServerFn(listActivities);
  const upFn = useServerFn(upsertActivity);
  const listWP = useServerFn(listWorkProducts);
  const qc = useQueryClient();
  const { data: rows } = useQuery({ queryKey: ["activities", courseId], queryFn: () => listFn({ data: { courseId } }) });
  const { data: wps } = useQuery({ queryKey: ["work-products", courseId], queryFn: () => listWP({ data: { courseId } }) });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    prompt: "",
    fieldsText: "summary | Executive summary | textarea\nmarket | Target market | textarea",
    workProductIds: [] as string[],
  });

  const parseFields = (txt: string): Field[] =>
    txt.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [key, label, type] = line.split("|").map((s) => s.trim());
      const t = (type === "text" || type === "textarea" || type === "number") ? type : "textarea";
      return { key: (key || "field").replace(/\s+/g, "_"), label: label || key || "Field", type: t };
    });

  const mut = useMutation({
    mutationFn: () => {
      const fields = parseFields(form.fieldsText);
      return upFn({ data: {
        id: editing ?? undefined,
        course_id: courseId,
        title: form.title,
        prompt: form.prompt,
        placement: "module",
        schema: { fields },
        work_product_ids: form.workProductIds,
      } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities", courseId] });
      setOpen(false); setEditing(null);
      setForm({ title: "", prompt: "", fieldsText: "", workProductIds: [] });
      toast.success("Activity saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleWp = (id: string) =>
    setForm((f) => ({ ...f, workProductIds: f.workProductIds.includes(id) ? f.workProductIds.filter((x) => x !== id) : [...f.workProductIds, id] }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2"><FileQuestion className="h-4 w-4" /> Activities</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); } }}>
          <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditing(null); setForm({ title: "", prompt: "", fieldsText: "summary | Executive summary | textarea", workProductIds: [] }); }}><Plus className="h-3 w-3" /> Add</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Edit activity" : "New activity"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Prompt shown to learner</Label><Textarea rows={3} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Input fields <span className="text-xs text-muted-foreground">(one per line: <code>key | label | text|textarea|number</code>)</span></Label>
                <Textarea rows={5} value={form.fieldsText} onChange={(e) => setForm({ ...form, fieldsText: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Generate these work products on submit</Label>
                <div className="flex flex-wrap gap-2">
                  {(wps ?? []).map((wp) => (
                    <button
                      key={wp.id} type="button"
                      onClick={() => toggleWp(wp.id)}
                      className={`rounded-full border px-3 py-1 text-xs ${form.workProductIds.includes(wp.id) ? "bg-primary text-primary-foreground border-primary" : "bg-muted"}`}
                    >{wp.title}</button>
                  ))}
                  {!wps?.length && <p className="text-xs text-muted-foreground">Add a work product template first.</p>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => mut.mutate()} disabled={!form.title || mut.isPending}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {(rows ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <div>
              <div className="font-medium">{a.title}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{((a.schema as { fields?: unknown[] } | null)?.fields?.length ?? 0)} fields</Badge>
                <Badge variant="outline" className="text-[10px]">{(a.work_product_ids ?? []).length} products</Badge>
                <code className="text-[10px]">{a.id.slice(0, 8)}</code>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(a.id); toast.success("Activity id copied — paste into lesson content"); }}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {!rows?.length && <p className="text-xs text-muted-foreground">No activities yet. Activities collect inputs from learners and feed the AI work product engine.</p>}
      </CardContent>
    </Card>
  );
}
