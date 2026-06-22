import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listEmployees, upsertEmployee } from "@/lib/modules.functions";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/employees")({
  head: () => ({ meta: [{ title: "Employees · BoostMyWorkforce" }] }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmployees);
  const upFn = useServerFn(upsertEmployee);
  const q = useQuery({ queryKey: ["employees"], queryFn: () => listFn({ data: {} }) });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ full_name: "", email: "", job_title: "", department: "" });

  const save = useMutation({
    mutationFn: () => upFn({ data: f }),
    onSuccess: () => { toast.success("Employee added"); setF({ full_name: "", email: "", job_title: "", department: "" }); setOpen(false); qc.invalidateQueries({ queryKey: ["employees"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Employees</h1>
          <p className="text-muted-foreground">Shared directory for Roles, Perform, and Pulse.</p>
        </div>
        <Button onClick={() => setOpen((v) => !v)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </header>

      {open && (
        <Card className="p-4 space-y-2">
          <div className="grid gap-2 md:grid-cols-2">
            <Input placeholder="Full name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
            <Input placeholder="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <Input placeholder="Job title" value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} />
            <Input placeholder="Department" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} />
          </div>
          <Button size="sm" onClick={() => save.mutate()} disabled={!f.full_name || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {q.isLoading ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> :
          (q.data?.rows.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-6 w-6" /> No employees yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase">
                <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Title</th><th className="px-4 py-2">Dept</th></tr>
              </thead>
              <tbody>
                {q.data!.rows.map((e: any) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-4 py-2">{e.full_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{e.email ?? "—"}</td>
                    <td className="px-4 py-2">{e.job_title ?? "—"}</td>
                    <td className="px-4 py-2">{e.department ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Card>
    </div>
  );
}
