import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllScreenings,
  listVouchers,
  createVoucher,
  voidVoucher,
  listAppointments,
  scheduleAppointment,
  updateAppointmentStatus,
  listAuthorizations,
  upsertAuthorization,
  deleteAuthorization,
} from "@/lib/state.functions";
import { listTenants } from "@/lib/tenants.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, X, Calendar } from "lucide-react";

export const Route = createFileRoute("/_app/admin/state")({
  head: () => ({ meta: [{ title: "State training · Boost Admin" }] }),
  component: StateAdminPage,
});

function StateAdminPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">State training operations</h1>
        <p className="text-sm text-muted-foreground">
          Eligibility, vouchers, scheduler, and authorizations queue.
        </p>
      </div>

      <Tabs defaultValue="screenings">
        <TabsList>
          <TabsTrigger value="screenings">Screenings</TabsTrigger>
          <TabsTrigger value="vouchers">Vouchers</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="authorizations">Authorizations</TabsTrigger>
        </TabsList>
        <TabsContent value="screenings" className="mt-4"><ScreeningsTab /></TabsContent>
        <TabsContent value="vouchers" className="mt-4"><VouchersTab /></TabsContent>
        <TabsContent value="appointments" className="mt-4"><AppointmentsTab /></TabsContent>
        <TabsContent value="authorizations" className="mt-4"><AuthorizationsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ScreeningsTab() {
  const fn = useServerFn(listAllScreenings);
  const { data, isLoading } = useQuery({ queryKey: ["all-screenings"], queryFn: () => fn() });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Recent eligibility screenings</CardTitle></CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && !data?.length && <p className="text-sm text-muted-foreground">No screenings yet.</p>}
        <ul className="divide-y">
          {(data ?? []).map((s: any) => (
            <li key={s.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <div className="font-mono text-xs text-muted-foreground">{s.user_id.slice(0, 8)}…</div>
                <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
              </div>
              <Badge variant={s.qualified ? "default" : "outline"}>
                {s.qualified ? "Qualified" : "Not eligible"}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function VouchersTab() {
  const listFn = useServerFn(listVouchers);
  const createFn = useServerFn(createVoucher);
  const voidFn = useServerFn(voidVoucher);
  const tenantsFn = useServerFn(listTenants);
  const qc = useQueryClient();
  const { data: vouchers } = useQuery({ queryKey: ["vouchers"], queryFn: () => listFn({ data: {} }) });
  const { data: tenants } = useQuery({ queryKey: ["tenants"], queryFn: () => tenantsFn() });

  const [tenantId, setTenantId] = useState("");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { tenantId, code, notes } }),
    onSuccess: () => {
      toast.success("Voucher created");
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      setCode("");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const voidMut = useMutation({
    mutationFn: (id: string) => voidFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Voided");
      qc.invalidateQueries({ queryKey: ["vouchers"] });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Issue voucher</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Tenant</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger><SelectValue placeholder="Tenant" /></SelectTrigger>
              <SelectContent>
                {(tenants ?? []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="STATE-1234" />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex items-end">
            <Button className="gap-2 w-full" disabled={!tenantId || !code || createMut.isPending} onClick={() => createMut.mutate()}>
              <Plus className="h-4 w-4" /> Issue
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Vouchers</CardTitle></CardHeader>
        <CardContent>
          {!vouchers?.length && <p className="text-sm text-muted-foreground">No vouchers yet.</p>}
          <ul className="divide-y">
            {(vouchers ?? []).map((v: any) => (
              <li key={v.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-mono">{v.code}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.notes ?? "—"} · {new Date(v.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={v.status === "redeemed" ? "default" : v.status === "void" ? "destructive" : "outline"}>
                    {v.status}
                  </Badge>
                  {v.status === "issued" && (
                    <Button size="sm" variant="ghost" onClick={() => voidMut.mutate(v.id)} className="gap-1">
                      <X className="h-4 w-4" /> Void
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function AppointmentsTab() {
  const listFn = useServerFn(listAppointments);
  const schedFn = useServerFn(scheduleAppointment);
  const updFn = useServerFn(updateAppointmentStatus);
  const screeningsFn = useServerFn(listAllScreenings);
  const qc = useQueryClient();
  const { data: appts } = useQuery({ queryKey: ["appointments"], queryFn: () => listFn() });
  const { data: screenings } = useQuery({ queryKey: ["all-screenings"], queryFn: () => screeningsFn() });

  const [eligId, setEligId] = useState("");
  const [when, setWhen] = useState("");

  const schedMut = useMutation({
    mutationFn: () => schedFn({ data: { eligibilityId: eligId, scheduledAt: new Date(when).toISOString() } }),
    onSuccess: () => {
      toast.success("Scheduled");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setEligId("");
      setWhen("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) => updFn({ data: { id, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const qualifiedScreenings = (screenings ?? []).filter((s: any) => s.qualified);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Schedule appointment</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label className="mb-1 block text-xs text-muted-foreground">Qualified screening</Label>
            <Select value={eligId} onValueChange={setEligId}>
              <SelectTrigger><SelectValue placeholder="Choose screening" /></SelectTrigger>
              <SelectContent>
                {qualifiedScreenings.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.user_id.slice(0, 8)}… · {new Date(s.created_at).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">When</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Button className="gap-2" disabled={!eligId || !when || schedMut.isPending} onClick={() => schedMut.mutate()}>
              <Calendar className="h-4 w-4" /> Schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Appointment queue</CardTitle></CardHeader>
        <CardContent>
          {!appts?.length && <p className="text-sm text-muted-foreground">No appointments yet.</p>}
          <ul className="divide-y">
            {(appts ?? []).map((a: any) => (
              <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div>{a.scheduled_at ? new Date(a.scheduled_at).toLocaleString() : "—"}</div>
                  <div className="text-xs text-muted-foreground font-mono">elig {a.eligibility_id.slice(0, 8)}…</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{a.status}</Badge>
                  <Select value={a.status} onValueChange={(v) => updMut.mutate({ id: a.id, status: v })}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="no_show">No-show</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function AuthorizationsTab() {
  const listFn = useServerFn(listAuthorizations);
  const upsertFn = useServerFn(upsertAuthorization);
  const delFn = useServerFn(deleteAuthorization);
  const tenantsFn = useServerFn(listTenants);
  const qc = useQueryClient();
  const { data: rows } = useQuery({ queryKey: ["authorizations"], queryFn: () => listFn() });
  const { data: tenants } = useQuery({ queryKey: ["tenants"], queryFn: () => tenantsFn() });

  const [tenantId, setTenantId] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [occupation, setOccupation] = useState("");
  const [etplStatus, setEtplStatus] = useState("");

  const upsertMut = useMutation({
    mutationFn: () => upsertFn({ data: { tenantId, stateCode, occupation, etplStatus } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["authorizations"] });
      setStateCode("");
      setOccupation("");
      setEtplStatus("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["authorizations"] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add authorization</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <Label className="mb-1 block text-xs text-muted-foreground">Tenant</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger><SelectValue placeholder="Tenant" /></SelectTrigger>
              <SelectContent>
                {(tenants ?? []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">State</Label>
            <Input value={stateCode} onChange={(e) => setStateCode(e.target.value)} placeholder="TX" maxLength={4} />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Occupation</Label>
            <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Welder" />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">ETPL status</Label>
            <Input value={etplStatus} onChange={(e) => setEtplStatus(e.target.value)} placeholder="approved" />
          </div>
          <div className="md:col-span-5">
            <Button className="gap-2" disabled={!tenantId || !stateCode || !occupation || upsertMut.isPending} onClick={() => upsertMut.mutate()}>
              <Plus className="h-4 w-4" /> Save authorization
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Authorizations</CardTitle></CardHeader>
        <CardContent>
          {!rows?.length && <p className="text-sm text-muted-foreground">No authorizations yet.</p>}
          <ul className="divide-y">
            {(rows ?? []).map((a: any) => (
              <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{a.state_code} · {a.occupation}</div>
                  <div className="text-xs text-muted-foreground">ETPL: {a.etpl_status ?? "—"}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => delMut.mutate(a.id)} className="gap-1">
                  <X className="h-4 w-4" /> Remove
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
