import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyVault, listMyEnrollments } from "@/lib/courses.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, FileText, Briefcase } from "lucide-react";

export const Route = createFileRoute("/_app/vault")({
  head: () => ({ meta: [{ title: "Student Vault · Boost" }] }),
  component: VaultPage,
});

const KIND_ICON: Record<string, any> = { badge: Award, work_product: Briefcase, report: FileText };

function VaultPage() {
  const vaultFn = useServerFn(listMyVault);
  const enrFn = useServerFn(listMyEnrollments);
  const { data: vault } = useQuery({ queryKey: ["vault"], queryFn: () => vaultFn() });
  const { data: enrollments } = useQuery({ queryKey: ["my-enrollments"], queryFn: () => enrFn() });

  const credentials = (enrollments ?? []).filter((e: any) => e.certifier_verify_url);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Student Vault</h1>
        <p className="text-sm text-muted-foreground">Your credentials, business deliverables, and downloads.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Credentials & badges</h2>
        {credentials.length ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {credentials.map((e: any) => (
              <Card key={e.id}>
                <CardHeader className="pb-2"><CardTitle className="text-base">{e.course?.title}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant="outline">Verified credential</Badge>
                  <a href={e.certifier_verify_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Verify</a>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No credentials yet. Complete a course to earn one.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Work products & files</h2>
        {(vault ?? []).length ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(vault ?? []).map((v: any) => {
              const Icon = KIND_ICON[v.kind] ?? FileText;
              return (
                <Card key={v.id}>
                  <CardHeader className="pb-2 flex flex-row items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{v.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {v.file_url && <a href={v.file_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Open</a>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Activities and the AI Work Product Engine will deposit deliverables here.</p>
        )}
      </section>
    </div>
  );
}
