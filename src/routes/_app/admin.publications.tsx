import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCourses } from "@/lib/courses.functions";
import { listTenants } from "@/lib/tenants.functions";
import {
  listPublications,
  publishCourseToTenant,
  unpublishCourse,
} from "@/lib/publications.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Send, X, Building2 } from "lucide-react";

export const Route = createFileRoute("/_app/admin/publications")({
  head: () => ({ meta: [{ title: "Publications · Boost Admin" }] }),
  component: PublicationsPage,
});

function PublicationsPage() {
  const coursesFn = useServerFn(listCourses);
  const tenantsFn = useServerFn(listTenants);
  const pubsFn = useServerFn(listPublications);
  const publishFn = useServerFn(publishCourseToTenant);
  const unpublishFn = useServerFn(unpublishCourse);
  const qc = useQueryClient();

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: () => coursesFn({ data: {} }),
  });
  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: () => tenantsFn(),
  });
  const { data: publications, isLoading } = useQuery({
    queryKey: ["publications"],
    queryFn: () => pubsFn({ data: {} }),
  });

  const [courseId, setCourseId] = useState<string>("");
  const [tenantId, setTenantId] = useState<string>("");

  const publishMut = useMutation({
    mutationFn: () => publishFn({ data: { courseId, tenantId } }),
    onSuccess: () => {
      toast.success("Course published to tenant");
      qc.invalidateQueries({ queryKey: ["publications"] });
      setCourseId("");
      setTenantId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unpublishMut = useMutation({
    mutationFn: (id: string) => unpublishFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Publication removed");
      qc.invalidateQueries({ queryKey: ["publications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Publishing & catalog</h1>
        <p className="text-sm text-muted-foreground">
          Publish a course to one or more tenants. Tenants only see courses you've published to them.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publish a course</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Course</label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Choose course" /></SelectTrigger>
              <SelectContent>
                {(courses ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title} <span className="ml-1 text-xs text-muted-foreground">/{c.slug}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Tenant</label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger><SelectValue placeholder="Choose tenant" /></SelectTrigger>
              <SelectContent>
                {(tenants ?? []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="gap-2"
            disabled={!courseId || !tenantId || publishMut.isPending}
            onClick={() => publishMut.mutate()}
          >
            <Send className="h-4 w-4" /> Publish
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active publications</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && !publications?.length && (
            <p className="text-sm text-muted-foreground">No publications yet.</p>
          )}
          <ul className="divide-y">
            {(publications ?? []).map((p: any) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.course?.title ?? "(deleted course)"}</span>
                    <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{p.source}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    <span>
                      {p.target_type === "tenant"
                        ? p.tenant?.name ?? "(unknown tenant)"
                        : `${p.target_type}: ${p.target_id ?? "—"}`}
                    </span>
                    <span>·</span>
                    <span>{new Date(p.published_at).toLocaleString()}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={() => unpublishMut.mutate(p.id)}
                  disabled={unpublishMut.isPending}
                >
                  <X className="h-4 w-4" /> Unpublish
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Need to edit a course?{" "}
        <Link to="/admin/courses" className="underline">Open the course library</Link>.
      </p>
    </div>
  );
}
