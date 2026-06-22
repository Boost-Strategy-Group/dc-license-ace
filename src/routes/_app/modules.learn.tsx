import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTenantPublishedCourses } from "@/lib/publications.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    <div className="mx-auto max-w-5xl space-y-8 py-12 px-4">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Boost!Learn</h1>
        <p className="text-muted-foreground">
          Courses published to your organization. Open the catalog to enroll.
        </p>
      </header>

      <div className="flex gap-2">
        <Button asChild><Link to="/catalog">Open full catalog</Link></Button>
        <Button asChild variant="outline"><Link to="/dashboard">My training</Link></Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Published to your tenant</h2>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && !data?.length && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No courses have been published to your tenant yet. Ask a super admin to publish from
              Publications.
            </CardContent>
          </Card>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {(data ?? []).map((p: any) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.course?.title ?? "—"}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{p.tenant?.name}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {p.course?.description ?? "—"}
                </p>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>{p.course?.contact_hours ?? 0}h</span>
                  <span>·</span>
                  <span>{p.course?.ceu_value ?? 0} CEU</span>
                </div>
                <Button asChild variant="outline" className="w-full">
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
