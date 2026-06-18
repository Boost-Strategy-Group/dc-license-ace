import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listStudents } from "@/lib/admin-stats.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/admin/students")({
  head: () => ({ meta: [{ title: "Students · Admin" }] }),
  component: Students,
});

function Students() {
  const fn = useServerFn(listStudents);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "students"], queryFn: () => fn() });
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Students</h1>
        <p className="text-muted-foreground">Apprentices in the DC LCSW cohort. New users self-register from the sign-in page.</p>
      </header>
      <Card>
        <CardHeader><CardTitle className="font-display">Roster</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Cohort</TableHead>
                  <TableHead className="text-right">Attempted</TableHead>
                  <TableHead className="text-right">Accuracy</TableHead>
                  <TableHead className="text-right">Mocks</TableHead>
                  <TableHead>Last active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name ?? "—"}</TableCell>
                    <TableCell>{s.cohort ? <Badge variant="secondary">{s.cohort}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.attempted}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.accuracy != null ? `${s.accuracy}%` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.mocks}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.lastActive ? new Date(s.lastActive).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
                {(!data || data.length === 0) && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No students yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
