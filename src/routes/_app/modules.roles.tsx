import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { listJobDescriptions, createJobDescription, listOrgNodes } from "@/lib/modules.functions";
import { BoostAgent } from "@/components/boost/BoostAgent";
import { Briefcase, Network, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/modules/roles")({
  head: () => ({ meta: [{ title: "Boost!Roles · BoostMyWorkforce" }] }),
  component: RolesHome,
});

function RolesHome() {
  const qc = useQueryClient();
  const listFn = useServerFn(listJobDescriptions);
  const orgFn = useServerFn(listOrgNodes);
  const createFn = useServerFn(createJobDescription);

  const jds = useQuery({ queryKey: ["jds"], queryFn: () => listFn({ data: {} }) });
  const org = useQuery({ queryKey: ["org"], queryFn: () => orgFn({ data: {} }) });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", summary: "" });
  const create = useMutation({
    mutationFn: (v: typeof form) => createFn({ data: v }),
    onSuccess: () => {
      toast.success("Job description drafted");
      setOpen(false); setForm({ title: "", summary: "" });
      qc.invalidateQueries({ queryKey: ["jds"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Boost!Roles</h1>
        <p className="text-muted-foreground">Job descriptions and org charts.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <h2 className="font-semibold">Job descriptions</h2>
              </div>
              <Button size="sm" onClick={() => setOpen((v) => !v)}><Plus className="h-4 w-4 mr-1" /> New JD</Button>
            </div>
            {open && (
              <div className="mb-4 space-y-2 rounded-md border bg-muted/30 p-3">
                <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Textarea placeholder="Summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
                <Button size="sm" onClick={() => create.mutate(form)} disabled={!form.title || create.isPending}>
                  {create.isPending ? "Saving…" : "Save draft"}
                </Button>
              </div>
            )}
            {jds.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
              (jds.data?.rows.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">No job descriptions yet.</p> :
              <ul className="divide-y">
                {jds.data!.rows.map((j: any) => (
                  <li key={j.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-sm font-medium">{j.title}</div>
                      {j.summary && <div className="text-xs text-muted-foreground line-clamp-1">{j.summary}</div>}
                    </div>
                    <Badge variant="outline">{j.status}</Badge>
                  </li>
                ))}
              </ul>}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Network className="h-4 w-4" />
              <h2 className="font-semibold">Org chart</h2>
            </div>
            {org.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
              (org.data?.rows.length ?? 0) === 0 ?
                <p className="text-sm text-muted-foreground">No nodes yet. Use the BOOST! agent or the employee directory to build one.</p> :
                <ul className="text-sm space-y-1">
                  {org.data!.rows.map((n: any) => <li key={n.id} className="ml-4">• {n.title}</li>)}
                </ul>}
          </Card>
        </div>

        <BoostAgent
          moduleKey="roles"
          intro="Hi — I'm BOOST! I can draft job descriptions and help you sketch an org chart. What role do you want to start with?"
        />
      </div>
    </div>
  );
}
