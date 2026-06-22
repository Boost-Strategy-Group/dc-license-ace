import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listApprenticeshipPrograms,
  upsertApprenticeshipProgram,
  listTenantApprentices,
  exportRtiCsv,
} from "@/lib/rti.functions";
import { listTenants } from "@/lib/tenants.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Download, GraduationCap, Plus } from "lucide-react";

export const Route = createFileRoute("/_app/admin/apprenticeship")({
  head: () => ({ meta: [{ title: "Apprenticeship · BoostMyWorkforce" }] }),
  component: AdminApprenticeship,
});

function AdminApprenticeship() {
  const tenantsFn = useServerFn(listTenants);
  const progsFn = useServerFn(listApprenticeshipPrograms);
  const upsertFn = useServerFn(upsertApprenticeshipProgram);
  const rosterFn = useServerFn(listTenantApprentices);
  const exportFn = useServerFn(exportRtiCsv);
  const qc = useQueryClient();

  const { data: tenants } = useQuery({ queryKey: ["tenants"], queryFn: () => tenantsFn() });
  const [tenantId, setTenantId] = useState<string>("");
  const [name, setName] = useState("");
  const [hours, setHours] = useState<number>(144);

  const { data: programs } = useQuery({
    queryKey: ["apprenticeship-programs", tenantId],
    queryFn: () => progsFn({ data: { tenantId } }),
    enabled: !!tenantId,
  });
  const { data: roster } = useQuery({
    queryKey: ["apprenticeship-roster", tenantId],
    queryFn: () => rosterFn({ data: { tenantId } }),
    enabled: !!tenantId,
  });

  const create = useMutation({
    mutationFn: () =>
      upsertFn({ data: { tenant_id: tenantId, name, required_rti_hours: hours } }),
    onSuccess: () => {
      toast.success("Program saved");
      setName("");
      qc.invalidateQueries({ queryKey: ["apprenticeship-programs", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExport = async () => {
    try {
      const { filename, csv } = await exportFn({ data: { tenantId } });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("RTI export downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <GraduationCap className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-semibold">Apprenticeship & RTI</h1>
          <p className="text-sm text-muted-foreground">
            Manage programs, monitor RTI hours, and export GoSprout-compatible reports.
          </p>
        </div>
      </header>

      <Card>
        <CardContent className="p-4">
          <Label className="text-xs">Tenant</Label>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select a tenant" />
            </SelectTrigger>
            <SelectContent>
              {(tenants ?? []).map((t: any) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {tenantId && (
        <Tabs defaultValue="roster">
          <TabsList>
            <TabsTrigger value="roster">Roster & RTI</TabsTrigger>
            <TabsTrigger value="programs">Programs</TabsTrigger>
          </TabsList>

          <TabsContent value="roster" className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Button onClick={handleExport} variant="outline">
                <Download className="mr-2 h-4 w-4" /> Export GoSprout CSV
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Apprentices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(roster ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No apprentices in this tenant yet.</p>
                )}
                {(roster ?? []).map((r) => {
                  const pct = r.required_hours
                    ? Math.min(100, Math.round((r.completed_hours / r.required_hours) * 100))
                    : 0;
                  return (
                    <div key={r.learner_id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{r.full_name ?? "Apprentice"}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.program_name ?? "No program"}
                            {r.last_activity
                              ? ` · last activity ${new Date(r.last_activity).toLocaleDateString()}`
                              : ""}
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {r.completed_hours} / {r.required_hours} hrs
                        </Badge>
                      </div>
                      <Progress value={pct} className="mt-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="programs" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add program</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Required RTI hours</Label>
                  <Input
                    type="number"
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => create.mutate()}
                    disabled={!name || create.isPending}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Save program
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Existing programs</CardTitle>
              </CardHeader>
              <CardContent>
                {(programs ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No programs yet.</p>
                )}
                <ul className="divide-y">
                  {(programs ?? []).map((p: any) => (
                    <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{p.name}</span>
                      <Badge variant="outline">{p.required_rti_hours} hrs</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
