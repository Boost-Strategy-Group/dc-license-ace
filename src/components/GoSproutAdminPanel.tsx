import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getGoSproutConfig,
  saveGoSproutConfig,
  listGoSproutLinks,
  upsertGoSproutLink,
  deleteGoSproutLink,
} from "@/lib/gosprout.functions";
import { listTenantMembers } from "@/lib/tenants.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Sprout, Trash2 } from "lucide-react";

export function GoSproutAdminPanel({ tenantId }: { tenantId: string }) {
  const getCfg = useServerFn(getGoSproutConfig);
  const saveCfg = useServerFn(saveGoSproutConfig);
  const listLinks = useServerFn(listGoSproutLinks);
  const upsertLink = useServerFn(upsertGoSproutLink);
  const delLink = useServerFn(deleteGoSproutLink);
  const membersFn = useServerFn(listTenantMembers);
  const qc = useQueryClient();

  const { data: cfg } = useQuery({
    queryKey: ["gosprout-cfg", tenantId],
    queryFn: () => getCfg({ data: { tenantId } }),
  });
  const { data: links } = useQuery({
    queryKey: ["gosprout-links", tenantId],
    queryFn: () => listLinks({ data: { tenantId } }),
  });
  const { data: members } = useQuery({
    queryKey: ["tenant-members", tenantId],
    queryFn: () => membersFn({ data: { tenantId } }),
  });

  const [form, setForm] = useState({
    enabled: false,
    default_login_url: "https://app.gosprout.io/",
    org_slug: "",
    instructions_md: "",
    integration_mode: "launchpad" as "launchpad" | "api",
  });
  useEffect(() => {
    if (cfg) setForm({
      enabled: cfg.enabled,
      default_login_url: cfg.default_login_url,
      org_slug: cfg.org_slug,
      instructions_md: cfg.instructions_md,
      integration_mode: cfg.integration_mode,
    });
  }, [cfg]);

  const save = useMutation({
    mutationFn: () => saveCfg({ data: { tenantId, ...form } }),
    onSuccess: () => { toast.success("GoSprout settings saved"); qc.invalidateQueries({ queryKey: ["gosprout-cfg", tenantId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newLink, setNewLink] = useState({ userId: "", username: "", url: "" });
  const addLink = useMutation({
    mutationFn: () => upsertLink({ data: {
      tenantId, userId: newLink.userId,
      gosprout_username: newLink.username || null,
      gosprout_program_url: newLink.url || null,
      status: "invited",
    } }),
    onSuccess: () => { toast.success("Learner linked"); setNewLink({ userId: "", username: "", url: "" }); qc.invalidateQueries({ queryKey: ["gosprout-links", tenantId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delLink({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gosprout-links", tenantId] }),
  });

  const learnerMembers = (members ?? []).filter((m: any) => m.role === "learner" || m.role === "mentor");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sprout className="h-5 w-5 text-emerald-600" /> GoSprout (apprenticeship)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <Label>Enable GoSprout launchpad</Label>
            <p className="text-xs text-muted-foreground">
              Shows a card on learner dashboards that opens GoSprout in a new tab.
            </p>
          </div>
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Default login URL</Label>
            <Input value={form.default_login_url} onChange={(e) => setForm({ ...form, default_login_url: e.target.value })} />
          </div>
          <div>
            <Label>Org slug (optional)</Label>
            <Input value={form.org_slug} onChange={(e) => setForm({ ...form, org_slug: e.target.value })} placeholder="acme" />
          </div>
        </div>
        <div>
          <Label>Instructions for learners</Label>
          <Textarea rows={3} value={form.instructions_md} onChange={(e) => setForm({ ...form, instructions_md: e.target.value })} placeholder="e.g. Use your sponsor-provided GoSprout password…" />
        </div>
        <div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save GoSprout settings"}
          </Button>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div>
            <h4 className="font-medium">Roster mapping</h4>
            <p className="text-xs text-muted-foreground">Assign each apprentice their GoSprout username and personal program link.</p>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr,1fr,1fr,auto]">
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={newLink.userId}
              onChange={(e) => setNewLink({ ...newLink, userId: e.target.value })}>
              <option value="">Select learner…</option>
              {learnerMembers.map((m: any) => (
                <option key={m.user_id} value={m.user_id}>{m.full_name ?? m.user_id.slice(0, 8)}</option>
              ))}
            </select>
            <Input placeholder="GoSprout username" value={newLink.username} onChange={(e) => setNewLink({ ...newLink, username: e.target.value })} />
            <Input placeholder="Personal program URL (optional)" value={newLink.url} onChange={(e) => setNewLink({ ...newLink, url: e.target.value })} />
            <Button onClick={() => addLink.mutate()} disabled={!newLink.userId || addLink.isPending}>
              {addLink.isPending ? "Saving…" : "Link"}
            </Button>
          </div>

          {(!links || links.length === 0) ? (
            <p className="text-sm text-muted-foreground">No learners linked yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {links.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{l.full_name ?? l.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.gosprout_username ?? "—"}{l.gosprout_program_url ? ` · ${l.gosprout_program_url}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{l.status}</Badge>
                    {l.last_launched_at && (
                      <span className="text-xs text-muted-foreground">opened {new Date(l.last_launched_at).toLocaleDateString()}</span>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(l.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
