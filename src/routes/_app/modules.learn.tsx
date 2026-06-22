import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTenantPublishedCourses } from "@/lib/publications.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModulePageHeader } from "@/components/boost/ModulePageHeader";
import { GraduationCap, Clock, Award } from "lucide-react";

export const Route = createFileRoute("/_app/modules/learn")({
  head: () => ({ meta: [{ title: "Boost!Learn · BoostMyWorkforce" }] }),
  component: LearnModule,
});

function LearnModule() {
  const fn = useServerFn(listTenantPublishedCourses);
  const { data, isLoading } = useQuery({
    queryKey: ["tenant-published"],
    queryFn: () => fn(),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <ModulePageHeader
        icon={GraduationCap}
        name="Boost!Learn"
        tagline="Courses published to your organization. Open the catalog to enroll."
        actions={
          <>
            <Button asChild><Link to="/catalog">Open full catalog</Link></Button>
            <Button asChild variant="outline"><Link to="/dashboard">My training</Link></Button>
          </>
        }
      />

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Published to your tenant</h2>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && !data?.length && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No courses have been published to your tenant yet. Ask a super admin to publish from
              Publications.
            </CardContent>
          </Card>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {(data ?? []).map((p: any) => (
            <Card key={p.id} className="flex flex-col transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug text-balance">{p.course?.title ?? "—"}</CardTitle>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{p.tenant?.name}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col space-y-3">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {p.course?.description ?? "—"}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden /> {p.course?.contact_hours ?? 0}h
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="size-3.5" aria-hidden /> {p.course?.ceu_value ?? 0} CEU
                  </span>
                </div>
                <Button asChild variant="outline" className="mt-auto w-full">
                  <Link to="/catalog">Enroll via catalog</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
