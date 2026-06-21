import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPublishedCourses, listMyEnrollments, enrollInCourse } from "@/lib/courses.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GraduationCap, Play } from "lucide-react";

export const Route = createFileRoute("/_app/catalog")({
  head: () => ({ meta: [{ title: "Catalog · Boost" }] }),
  component: CatalogPage,
});

function CatalogPage() {
  const listFn = useServerFn(listPublishedCourses);
  const enrollFn = useServerFn(enrollInCourse);
  const myFn = useServerFn(listMyEnrollments);
  const qc = useQueryClient();

  const { data: courses, isLoading } = useQuery({ queryKey: ["catalog"], queryFn: () => listFn() });
  const { data: mine } = useQuery({ queryKey: ["my-enrollments"], queryFn: () => myFn() });
  const enrolledIds = new Set((mine ?? []).map((e: any) => e.course_id));

  const mut = useMutation({
    mutationFn: (courseId: string) => enrollFn({ data: { courseId } }),
    onSuccess: () => {
      toast.success("Enrolled");
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Course catalog</h1>
        <p className="text-sm text-muted-foreground">Programs available across the BOOST learning network.</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(courses ?? []).map((c: any) => {
          const enrolled = enrolledIds.has(c.id);
          return (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{c.title}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{c.tenant?.name}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-2 text-sm text-muted-foreground">{c.description ?? "—"}</p>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>{c.contact_hours ?? 0}h</span><span>·</span>
                  <span>{c.ceu_value ?? 0} CEU</span>
                </div>
                {enrolled ? (
                  <Link to="/learn/$courseId" params={{ courseId: c.id }}>
                    <Button className="w-full gap-2"><Play className="h-4 w-4" /> Continue</Button>
                  </Link>
                ) : (
                  <Button className="w-full gap-2" onClick={() => mut.mutate(c.id)} disabled={mut.isPending}>
                    <GraduationCap className="h-4 w-4" /> Enroll
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && !courses?.length && (
          <p className="col-span-full text-sm text-muted-foreground">No published courses yet.</p>
        )}
      </div>
    </div>
  );
}
