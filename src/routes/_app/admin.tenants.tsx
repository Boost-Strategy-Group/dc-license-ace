import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTenants, upsertTenant } from "@/lib/tenants.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, ExternalLink, Plus } from "lucide-react";

export const Route = createFileRoute("/_app/admin/tenants")({
  head: () => ({ meta: [{ title: "Tenants · Boost Admin" }] }),
  component: TenantsPage,
});

function TenantsPage() {
  const fn = useServerFn(listTenants);
  const { data, isLoading } = useQuery({ queryKey: ["tenants"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Tenants</h1>
          <p className="text-sm text-muted-foreground">Client portals, apprenticeship programs, and the Boost root tenant.</p>
        </div>
        <NewTenantDialog />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-10 w-10 place-items-center rounded-md font-display text-lg font-semibold text-white"
                  style={{ backgroundColor: t.brand_primary ?? "#0B2545" }}
                >
                  {t.name.charAt(0)}
                </div>
                <div>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <div className="text-xs text-muted-foreground">/c/{t.slug}</div>
                </div>
              </div>
              <Badge variant="outline">{t.kind}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="line-clamp-2 text-sm text-muted-foreground">{t.welcome_copy ?? "—"}</p>
              <div className="flex gap-2 pt-2">
                <Link to="/admin/tenants/$tenantId" params={{ tenantId: t.id }} className="flex-1">
                  <Button variant="outline" className="w-full gap-2"><Building2 className="h-4 w-4" /> Manage</Button>
                </Link>
                <a href={`/c/${t.slug}`} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="icon" title="View public portal"><ExternalLink className="h-4 w-4" /></Button>
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewTenantDialog() {
  const fn = useServerFn(upsertTenant);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    name: "",
    kind: "client" as "root" | "apprenticeship" | "client",
    welcome_copy: "",
    brand_primary: "#0B2545",
    brand_secondary: "#C9A227",
  });
  const mut = useMutation({
    mutationFn: (vars: typeof form) => fn({ data: vars }),
    onSuccess: () => {
      toast.success("Tenant created");
      qc.invalidateQueries({ queryKey: ["tenants"] });
      setOpen(false);
      setForm({ slug: "", name: "", kind: "client", welcome_copy: "", brand_primary: "#0B2545", brand_secondary: "#C9A227" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New tenant</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create tenant</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Client Acme Inc." /></div>
          <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="acme" /></div>
          <div>
            <Label>Kind</Label>
            <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as any })}>
              <option value="client">Client</option>
              <option value="apprenticeship">Apprenticeship</option>
              <option value="root">Root (Boost)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Primary color</Label><Input type="color" value={form.brand_primary} onChange={(e) => setForm({ ...form, brand_primary: e.target.value })} /></div>
            <div><Label>Accent color</Label><Input type="color" value={form.brand_secondary} onChange={(e) => setForm({ ...form, brand_secondary: e.target.value })} /></div>
          </div>
          <div><Label>Welcome copy</Label><Textarea rows={3} value={form.welcome_copy} onChange={(e) => setForm({ ...form, welcome_copy: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate(form)} disabled={mut.isPending || !form.slug || !form.name}>
            {mut.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
