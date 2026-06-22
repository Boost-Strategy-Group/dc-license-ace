import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { listTenants, inviteToTenant } from "@/lib/tenants.functions";
import {
  listBoostModules,
  listTenantBoostModules,
  type TenantModuleStatus,
} from "@/lib/launchpad.functions";
import {
  listTenantStudents,
  setStudentModules,
} from "@/lib/student-management.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/admin/student-management")({
  head: () => ({ meta: [{ title: "Student Management · Boost Admin" }] }),
  component: StudentManagement,
});

const MODULE_LABELS: Record<string, string> = {
  roles: "Boost!Roles",
  perform: "Boost!Perform",
  pulse: "Boost!Pulse",
  learn: "Boost!Learn",
};

function StudentManagement() {
  const tenantsFn = useServerFn(listTenants);
  const { data: tenants } = useQuery({ queryKey: ["tenants"], queryFn: () => tenantsFn() });

  const [tenantId, setTenantId] = useState<string>("");
  const activeTenantId = tenantId || tenants?.[0]?.id || "";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Student management</h1>
        <p className="text-sm text-muted-foreground">
          Enroll students into a tenant and assign which Boost! modules they can access.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={activeTenantId}
            onChange={(e) => setTenantId(e.target.value)}
          >
            {(tenants ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.kind})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {activeTenantId && <TenantStudents tenantId={activeTenantId} />}
    </div>
  );
}

function TenantStudents({ tenantId }: { tenantId: string }) {
  const inviteFn = useServerFn(inviteToTenant);
  const studentsFn = useServerFn(listTenantStudents);
  const allModulesFn = useServerFn(listBoostModules);
  const tenantModulesFn = useServerFn(listTenantBoostModules);
  const setModulesFn = useServerFn(setStudentModules);
  const qc = useQueryClient();

  const studentsKey = ["tenant-students", tenantId];
  const { data: students } = useQuery({
    queryKey: studentsKey,
    queryFn: () => studentsFn({ data: { tenantId } }),
  });
  const { data: allModules } = useQuery({
    queryKey: ["boost-modules"],
    queryFn: () => allModulesFn(),
  });
  const { data: tenantModules } = useQuery({
    queryKey: ["tenant-boost-modules", tenantId],
    queryFn: () => tenantModulesFn({ data: { tenantId } }),
  });

  const enabledModules = useMemo(() => {
    const statuses = new Map<string, TenantModuleStatus>(
      (tenantModules ?? []).map((t) => [t.boost_module_id, t.status]),
    );
    return (allModules ?? []).filter((m) => statuses.get(m.id) === "active");
  }, [allModules, tenantModules]);

  const [invite, setInvite] = useState({ email: "", role: "learner" as const });
  const sendInvite = useMutation({
    mutationFn: () =>
      inviteFn({ data: { tenantId, email: invite.email, role: invite.role } }),
    onSuccess: () => {
      toast.success("Student enrolled");
      setInvite({ email: "", role: "learner" });
      qc.invalidateQueries({ queryKey: studentsKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveModules = useMutation({
    mutationFn: (vars: { memberId: string; moduleIds: string[] }) =>
      setModulesFn({ data: vars }),
    onSuccess: () => {
      toast.success("Modules updated");
      qc.invalidateQueries({ queryKey: studentsKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Enroll student</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr,auto]">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="student@company.com"
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              New users get an invite email. Existing users are added to this tenant as a learner.
            </p>
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => sendInvite.mutate()}
              disabled={sendInvite.isPending || !invite.email}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {sendInvite.isPending ? "Enrolling…" : "Enroll"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
          {enabledModules.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No Boost! modules are enabled for this tenant yet. Activate modules on the tenant
              page to allow student assignments.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!students || students.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {students.map((s) => (
                <li key={s.member_id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{s.full_name ?? s.user_id.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">
                        Enrolled {new Date(s.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant="outline">{s.role}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4">
                    {enabledModules.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No modules to assign.</span>
                    ) : (
                      enabledModules.map((m) => {
                        const checked = s.module_ids.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const next = v
                                  ? [...s.module_ids, m.id]
                                  : s.module_ids.filter((id) => id !== m.id);
                                saveModules.mutate({ memberId: s.member_id, moduleIds: next });
                              }}
                              disabled={saveModules.isPending}
                            />
                            <span>{MODULE_LABELS[m.key] ?? m.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
