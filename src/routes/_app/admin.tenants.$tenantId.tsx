import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTenants, listTenantMembers, inviteToTenant, removeTenantMember, upsertTenant } from "@/lib/tenants.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Trash2, UserPlus } from "lucide-react";
import { GoSproutAdminPanel } from "@/components/GoSproutAdminPanel";

export const Route = createFileRoute("/_app/admin/tenants/$tenantId")({
  head: () => ({ meta: [{ title: "Tenant · Boost Admin" }] }),
  component: TenantDetail,
});

function TenantDetail() {
  const { tenantId } = Route.useParams();
  const listFn = useServerFn(listTenants);
  const membersFn = useServerFn(listTenantMembers);
  const upsertFn = useServerFn(upsertTenant);
  const inviteFn = useServerFn(inviteToTenant);
  const removeFn = useServerFn(removeTenantMember);
  const qc = useQueryClient();

  const { data: tenants } = useQuery({ queryKey: ["tenants"], queryFn: () => listFn() });
  const tenant = tenants?.find((t) => t.id === tenantId);

  const { data: members } = useQuery({
    queryKey: ["tenant-members", tenantId],
    queryFn: () => membersFn({ data: { tenantId } }),
    enabled: !!tenantId,
  });

  const [branding, setBranding] = useState({
    name: "",
    slug: "",
    welcome_copy: "",
    brand_primary: "#0B2545",
    brand_secondary: "#C9A227",
    logo_url: "",
    powered_by_boost_footer: true,
  });
  useEffect(() => {
    if (tenant) {
      setBranding({
        name: tenant.name,
        slug: tenant.slug,
        welcome_copy: tenant.welcome_copy ?? "",
        brand_primary: tenant.brand_primary ?? "#0B2545",
        brand_secondary: tenant.brand_secondary ?? "#C9A227",
        logo_url: tenant.logo_url ?? "",
        powered_by_boost_footer: tenant.powered_by_boost_footer,
      });
    }
  }, [tenant?.id]);

  const saveBranding = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: tenantId,
          slug: branding.slug,
          name: branding.name,
          kind: (tenant?.kind as any) ?? "client",
          welcome_copy: branding.welcome_copy || null,
          brand_primary: branding.brand_primary,
          brand_secondary: branding.brand_secondary,
          logo_url: branding.logo_url || null,
          powered_by_boost_footer: branding.powered_by_boost_footer,
        },
      }),
    onSuccess: () => {
      toast.success("Branding saved");
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [invite, setInvite] = useState({ email: "", role: "learner" as "tenant_admin" | "instructor" | "learner" | "mentor" });
  const sendInvite = useMutation({
    mutationFn: () => inviteFn({ data: { tenantId, email: invite.email, role: invite.role } }),
    onSuccess: () => {
      toast.success("Invite sent");
      setInvite({ email: "", role: "learner" });
      qc.invalidateQueries({ queryKey: ["tenant-members", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => removeFn({ data: { memberId } }),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["tenant-members", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tenant) return <p className="text-sm text-muted-foreground">Loading tenant…</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/admin/tenants" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All tenants
        </Link>
        <a href={`/c/${tenant.slug}`} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm" className="gap-2"><ExternalLink className="h-4 w-4" /> View public portal</Button>
        </a>
      </div>

      <header>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-md font-display text-xl font-semibold text-white" style={{ backgroundColor: tenant.brand_primary ?? "#0B2545" }}>
            {tenant.name.charAt(0)}
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold">{tenant.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>/c/{tenant.slug}</span>
              <Badge variant="outline">{tenant.kind}</Badge>
            </div>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label>Name</Label><Input value={branding.name} onChange={(e) => setBranding({ ...branding, name: e.target.value })} /></div>
          <div><Label>Slug</Label><Input value={branding.slug} onChange={(e) => setBranding({ ...branding, slug: e.target.value.toLowerCase() })} /></div>
          <div><Label>Logo URL</Label><Input value={branding.logo_url} onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })} placeholder="https://…" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Primary</Label><Input type="color" value={branding.brand_primary} onChange={(e) => setBranding({ ...branding, brand_primary: e.target.value })} /></div>
            <div><Label>Accent</Label><Input type="color" value={branding.brand_secondary} onChange={(e) => setBranding({ ...branding, brand_secondary: e.target.value })} /></div>
          </div>
          <div className="md:col-span-2"><Label>Welcome copy</Label><Textarea rows={3} value={branding.welcome_copy} onChange={(e) => setBranding({ ...branding, welcome_copy: e.target.value })} /></div>
          <div className="md:col-span-2 flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label>Show "Powered by Boost" footer</Label>
              <p className="text-xs text-muted-foreground">Off for Boost itself; on for client and apprenticeship tenants.</p>
            </div>
            <Switch checked={branding.powered_by_boost_footer} onCheckedChange={(v) => setBranding({ ...branding, powered_by_boost_footer: v })} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => saveBranding.mutate()} disabled={saveBranding.isPending}>
              {saveBranding.isPending ? "Saving…" : "Save branding"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Invite member</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr,200px,auto]">
          <Input placeholder="email@example.com" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
          <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as any })}>
            <option value="learner">Learner</option>
            <option value="instructor">Instructor</option>
            <option value="tenant_admin">Tenant admin</option>
            <option value="mentor">Mentor</option>
          </select>
          <Button onClick={() => sendInvite.mutate()} disabled={sendInvite.isPending || !invite.email} className="gap-2">
            <UserPlus className="h-4 w-4" /> {sendInvite.isPending ? "Sending…" : "Invite"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Members</CardTitle></CardHeader>
        <CardContent>
          {!members || members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet. Invite the first above.</p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium">{m.full_name ?? m.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">Joined {new Date(m.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{m.role}</Badge>
                    <Button size="icon" variant="ghost" onClick={() => removeMember.mutate(m.id)} title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <GoSproutAdminPanel tenantId={tenantId} />
    </div>
  );
}
