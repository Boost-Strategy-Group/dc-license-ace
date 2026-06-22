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
import { ModulePageHeader } from "@/components/boost/ModulePageHeader";
import { Briefcase, Network, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/modules/roles")({
  head: () => ({ meta: [{ title: "Boost!Roles · BoostMyWorkforce" }] }),
  component: RolesHome,
});

function RolesHome() {
  const qc = useQueryClient();
  const { user, canManageRoles } = useAuth();
  const listFn = useServerFn(listJobDescriptions);
  const orgFn = useServerFn(listOrgNodes);
  const createFn = useServerFn(createJobDescription);

  const jds = useQuery({ queryKey: ["jds"], queryFn: () => listFn({ data: {} }) });
  const org = useQuery({
    queryKey: ["org"],
    queryFn: () => orgFn({ data: {} }),
    enabled: canManageRoles,
  });

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

  // Learners only see their own JD (matched by assigned user_id, falling back to created_by).
  const allRows: any[] = jds.data?.rows ?? [];
  const visibleRows = canManageRoles
    ? allRows
    : allRows.filter((j) => j.assigned_user_id === user?.id || j.user_id === user?.id || j.created_by === user?.id);
  const myJd = !canManageRoles ? visibleRows[0] : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <ModulePageHeader
        icon={Briefcase}
        name="Boost!Roles"
        tagline={canManageRoles ? "Define job descriptions and map your org chart." : "Your role and job description."}
        actions={
          canManageRoles ? (
            <Button size="sm" onClick={() => setOpen((v) => !v)}>
              <Plus className="mr-1 h-4 w-4" /> New JD
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-md bg-accent/15">
                <Briefcase className="h-4 w-4 text-accent-foreground" aria-hidden />
              </div>
              <h2 className="font-semibold">{canManageRoles ? "Job descriptions" : "My job description"}</h2>
            </div>

            {canManageRoles && open && (
              <div className="mb-4 space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Textarea placeholder="Summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
                <Button size="sm" onClick={() => create.mutate(form)} disabled={!form.title || create.isPending}>
                  {create.isPending ? "Saving…" : "Save draft"}
                </Button>
              </div>
            )}

            {jds.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !canManageRoles ? (
              myJd ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold">{myJd.title}</div>
                      {myJd.summary && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{myJd.summary}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="capitalize">{myJd.status}</Badge>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border py-10 text-center">
                  <p className="text-sm font-medium">No job description assigned yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Your manager will publish it here when it's ready.</p>
                </div>
              )
            ) : visibleRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-10 text-center">
                <p className="text-sm font-medium">No job descriptions yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Create your first JD or ask the BOOST! agent to draft one.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {visibleRows.map((j: any) => (
                  <li key={j.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{j.title}</div>
                      {j.summary && <div className="truncate text-xs text-muted-foreground">{j.summary}</div>}
                    </div>
                    <Badge variant="outline" className="capitalize">{j.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canManageRoles && (
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-md bg-accent/15">
                  <Network className="h-4 w-4 text-accent-foreground" aria-hidden />
                </div>
                <h2 className="font-semibold">Org chart</h2>
              </div>
              {org.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (org.data?.rows.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-10 text-center">
                  <p className="text-sm font-medium">No org nodes yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Use the BOOST! agent or the employee directory to build one.</p>
                </div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {org.data!.rows.map((n: any) => (
                    <li key={n.id} className="flex items-center gap-2 rounded-md px-3 py-1.5">
                      <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                      {n.title}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        {canManageRoles && (
          <BoostAgent
            moduleKey="roles"
            intro="Hi — I'm BOOST! I can draft job descriptions and help you sketch an org chart. What role do you want to start with?"
          />
        )}
      </div>
    </div>
  );
}

