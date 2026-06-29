/**
 * Boost!Learn Module — /_app/$slug/learn
 *
 * Sections (all roles):
 *   1. AI Recommendations — dismissable horizontal scroll
 *   2. In Progress — enrollments with progress bar
 *   3. Course Catalog — published courses, featured first
 *   4. Learning Paths — accordion with enroll-in-path
 *   5. My Certificates — grid with download placeholder
 *   6. Content Library — searchable table
 *
 * Admin additional:
 *   Manage Courses tab — all courses incl. drafts
 *
 * Brand accent: var(--boost-learn) — navy
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { useAuth } from "@/hooks/use-auth";
import {
  listPublishedCourses,
  listAllCoursesAdmin,
  getMyEnrollments,
  enrollInCourse,
  listLearningPaths,
  enrollInPath,
  getMyCertificates,
  getAiRecommendations,
  dismissRecommendation,
  getContentLibrary,
} from "@/lib/learn.functions";

// ── Shadcn/ui ──────────────────────────────────────────────────────────────
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/$slug/learn")({
  head: () => ({
    meta: [{ title: "Boost!Learn · BOOST! My WorkForce Suite" }],
  }),
  component: LearnModule,
});

// ── Types ──────────────────────────────────────────────────────────────────

type Course = {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  duration_minutes: number | null;
  status: "draft" | "published";
  is_featured: boolean;
};

type Enrollment = {
  id: string;
  course_id: string;
  status: "enrolled" | "in_progress" | "completed";
  enrolled_at: string;
  completed_at: string | null;
  course?: Course;
  progress?: { progress_pct: number; last_accessed_at: string }[];
};

type LearningPath = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published";
  courses?: { sort_order: number; course: Pick<Course, "id" | "title" | "duration_minutes" | "status" | "content_type"> }[];
};

type Certificate = {
  id: string;
  issued_at: string;
  expires_at: string | null;
  course?: { title: string } | null;
  template?: { name: string } | null;
};

type AiRec = {
  id: string;
  reason: string;
  status: "active" | "dismissed" | "enrolled";
  course?: Pick<Course, "id" | "title" | "description" | "duration_minutes" | "content_type"> | null;
};

type ContentItem = {
  id: string;
  title: string;
  content_type: string;
  url: string | null;
  tags: unknown;
  is_public: boolean;
};

// ── Main Component ─────────────────────────────────────────────────────────

function LearnModule() {
  const { tenant, slug } = useTenant();
  const { isSuperAdmin, isBsgAdmin, isTenantAdmin, isManager } = useAuth();

  const isAdmin = isSuperAdmin || isBsgAdmin || isTenantAdmin;

  // Data
  const [recs, setRecs] = useState<AiRec[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [library, setLibrary] = useState<ContentItem[]>([]);
  const [libQuery, setLibQuery] = useState("");

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("learn");
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [pathEnrollingId, setPathEnrollingId] = useState<string | null>(null);

  async function loadLearnTab() {
    if (!slug) return;
    setError(null);
    setLoading(true);
    try {
      const [recsData, enrollData, courseData, pathData, certData] = await Promise.all([
        getAiRecommendations({ slug }),
        getMyEnrollments({ slug }),
        listPublishedCourses({ slug }),
        listLearningPaths({ slug }),
        getMyCertificates({ slug }),
      ]);
      setRecs(recsData as AiRec[]);
      setEnrollments(enrollData as Enrollment[]);
      setCourses(courseData as Course[]);
      setPaths(pathData as LearningPath[]);
      setCerts(certData as Certificate[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load learning data");
    } finally {
      setLoading(false);
    }
  }

  async function loadLibrary(q?: string) {
    if (!slug) return;
    setLoading(true);
    try {
      const data = await getContentLibrary({ slug, q: q ?? libQuery });
      setLibrary(data as ContentItem[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load library");
    } finally {
      setLoading(false);
    }
  }

  async function loadManageTab() {
    if (!slug) return;
    setLoading(true);
    try {
      const data = await listAllCoursesAdmin({ slug });
      setAllCourses(data as Course[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLearnTab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function handleEnroll(courseId: string) {
    if (!slug) return;
    setEnrollingId(courseId);
    try {
      await enrollInCourse({ slug, course_id: courseId });
      await loadLearnTab();
    } catch (e: any) {
      setError(e?.message ?? "Enrollment failed");
    } finally {
      setEnrollingId(null);
    }
  }

  async function handleEnrollPath(pathId: string) {
    if (!slug) return;
    setPathEnrollingId(pathId);
    try {
      await enrollInPath({ slug, path_id: pathId });
      await loadLearnTab();
    } catch (e: any) {
      setError(e?.message ?? "Path enrollment failed");
    } finally {
      setPathEnrollingId(null);
    }
  }

  async function handleDismissRec(recId: string) {
    try {
      await dismissRecommendation({ rec_id: recId });
      setRecs((prev) => prev.filter((r) => r.id !== recId));
    } catch (e: any) {
      setError(e?.message ?? "Failed to dismiss");
    }
  }

  const enrolledCourseIds = new Set(enrollments.map((e) => e.course_id));
  const accentColor = "var(--boost-learn)";

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: accentColor }} />
        <h1 className="text-2xl font-bold text-foreground">Boost!Learn</h1>
        <Badge variant="outline" className="ml-auto text-xs" style={{ borderColor: accentColor, color: accentColor }}>
          {tenant?.name}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}{" "}
            <button className="underline ml-2" onClick={() => loadLearnTab()}>
              Retry
            </button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        defaultValue="learn"
        onValueChange={(v) => {
          setActiveTab(v);
          if (v === "library") loadLibrary();
          else if (v === "manage" && isAdmin) loadManageTab();
        }}
      >
        <TabsList>
          <TabsTrigger value="learn">My Learning</TabsTrigger>
          <TabsTrigger value="catalog">Course Catalog</TabsTrigger>
          <TabsTrigger value="paths">Learning Paths</TabsTrigger>
          <TabsTrigger value="certs">Certificates</TabsTrigger>
          <TabsTrigger value="library">Content Library</TabsTrigger>
          {isAdmin && <TabsTrigger value="manage">Manage Courses</TabsTrigger>}
        </TabsList>

        {/* ── MY LEARNING ── */}
        <TabsContent value="learn">
          {loading ? (
            <div className="space-y-4 mt-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-8 mt-4">
              {/* AI Recommendations */}
              {recs.length > 0 && (
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Recommended for You
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {recs.map((rec) => (
                      <Card key={rec.id} className="border border-border shrink-0 w-64">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm leading-tight line-clamp-2">
                            {rec.course?.title ?? "Course"}
                          </CardTitle>
                          <TypeBadge type={rec.course?.content_type ?? ""} accentColor={accentColor} />
                        </CardHeader>
                        <CardContent className="pt-0">
                          {rec.reason && (
                            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                              {rec.reason}
                            </p>
                          )}
                          {rec.course?.duration_minutes && (
                            <p className="text-xs text-muted-foreground mb-3">
                              {formatDuration(rec.course.duration_minutes)}
                            </p>
                          )}
                          <div className="flex gap-2">
                            {rec.course && !enrolledCourseIds.has(rec.course.id) && (
                              <Button
                                size="sm"
                                className="flex-1 text-xs"
                                style={{ backgroundColor: accentColor, color: "#fff" }}
                                disabled={enrollingId === rec.course.id}
                                onClick={() => rec.course && handleEnroll(rec.course.id)}
                              >
                                {enrollingId === rec.course.id ? "Enrolling…" : "Enroll"}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs px-2"
                              onClick={() => handleDismissRec(rec.id)}
                            >
                              ✕
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* In Progress */}
              {enrollments.length > 0 && (
                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    In Progress
                  </p>
                  <div className="space-y-3">
                    {enrollments.map((e) => {
                      const pct = e.progress?.[0]?.progress_pct ?? 0;
                      return (
                        <Card key={e.id} className="border border-border">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center justify-between gap-4 mb-2">
                              <p className="text-sm font-semibold truncate flex-1">
                                {e.course?.title ?? "Course"}
                              </p>
                              <TypeBadge type={e.course?.content_type ?? ""} accentColor={accentColor} />
                            </div>
                            <div className="flex items-center gap-3">
                              <Progress value={pct} className="flex-1 h-2" />
                              <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                                {pct}%
                              </span>
                            </div>
                            {e.progress?.[0]?.last_accessed_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Last accessed{" "}
                                {new Date(e.progress[0].last_accessed_at).toLocaleDateString()}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              )}

              {recs.length === 0 && enrollments.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  No courses in progress. Browse the catalog to get started.
                </p>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── COURSE CATALOG ── */}
        <TabsContent value="catalog">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : courses.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground text-sm">
              No published courses yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {courses.map((c) => {
                const isEnrolled = enrolledCourseIds.has(c.id);
                return (
                  <Card key={c.id} className="border border-border flex flex-col">
                    {c.is_featured && (
                      <div
                        className="h-1 rounded-t-xl"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-semibold leading-tight line-clamp-2 flex-1">
                          {c.title}
                        </CardTitle>
                        {c.is_featured && (
                          <Badge className="text-xs shrink-0" style={{ backgroundColor: accentColor, color: "#fff" }}>
                            Featured
                          </Badge>
                        )}
                      </div>
                      <TypeBadge type={c.content_type} accentColor={accentColor} />
                      {c.duration_minutes && (
                        <p className="text-xs text-muted-foreground">{formatDuration(c.duration_minutes)}</p>
                      )}
                    </CardHeader>
                    {c.description && (
                      <CardContent className="pt-0 pb-2 flex-1">
                        <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                      </CardContent>
                    )}
                    <CardContent className="pt-0">
                      {isEnrolled ? (
                        <Badge variant="outline" className="text-xs w-full justify-center py-1" style={{ borderColor: accentColor, color: accentColor }}>
                          Enrolled
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          style={{ backgroundColor: accentColor, color: "#fff" }}
                          disabled={enrollingId === c.id}
                          onClick={() => handleEnroll(c.id)}
                        >
                          {enrollingId === c.id ? "Enrolling…" : "Enroll"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── LEARNING PATHS ── */}
        <TabsContent value="paths">
          {loading ? (
            <Skeleton className="h-48 rounded-xl mt-4" />
          ) : paths.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground text-sm">
              No learning paths published yet.
            </p>
          ) : (
            <Accordion type="multiple" className="mt-4 space-y-2">
              {paths.map((path) => {
                const totalMinutes = path.courses?.reduce(
                  (sum, pc) => sum + (pc.course?.duration_minutes ?? 0),
                  0,
                ) ?? 0;
                return (
                  <AccordionItem key={path.id} value={path.id} className="border border-border rounded-xl px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <div>
                          <p className="text-sm font-semibold">{path.title}</p>
                          {path.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{path.description}</p>
                          )}
                          {totalMinutes > 0 && (
                            <p className="text-xs text-muted-foreground">{formatDuration(totalMinutes)}</p>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 py-2">
                        {(path.courses ?? [])
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((pc, idx) => (
                            <div
                              key={pc.course?.id ?? idx}
                              className="flex items-center justify-between gap-3 py-1"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">
                                  {idx + 1}.
                                </span>
                                <p className="text-xs font-medium truncate">{pc.course?.title}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {pc.course?.duration_minutes && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatDuration(pc.course.duration_minutes)}
                                  </span>
                                )}
                                <TypeBadge type={pc.course?.content_type ?? ""} accentColor={accentColor} />
                                {pc.course && !enrolledCourseIds.has(pc.course.id) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-6 px-2"
                                    disabled={enrollingId === pc.course.id}
                                    onClick={() => pc.course && handleEnroll(pc.course.id)}
                                  >
                                    Enroll
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        <div className="pt-2 border-t">
                          <Button
                            size="sm"
                            className="text-xs"
                            style={{ backgroundColor: accentColor, color: "#fff" }}
                            disabled={pathEnrollingId === path.id}
                            onClick={() => handleEnrollPath(path.id)}
                          >
                            {pathEnrollingId === path.id ? "Enrolling…" : "Enroll in Full Path"}
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </TabsContent>

        {/* ── CERTIFICATES ── */}
        <TabsContent value="certs">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : certs.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground text-sm">
              No certificates yet. Complete a course to earn your first one.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {certs.map((cert) => (
                <Card key={cert.id} className="border border-border">
                  <CardHeader className="pb-2">
                    <div className="h-1 w-8 rounded-full mb-2" style={{ backgroundColor: accentColor }} />
                    <CardTitle className="text-sm leading-tight">{cert.course?.title ?? "Course"}</CardTitle>
                    {cert.template?.name && (
                      <p className="text-xs text-muted-foreground">{cert.template.name}</p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground mb-3">
                      Issued {new Date(cert.issued_at).toLocaleDateString()}
                      {cert.expires_at && ` · Expires ${new Date(cert.expires_at).toLocaleDateString()}`}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      style={{ borderColor: accentColor, color: accentColor }}
                      onClick={() => {
                        // Certificate download — placeholder until Certifiably integration (Step 7)
                        window.print();
                      }}
                    >
                      Download
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── CONTENT LIBRARY ── */}
        <TabsContent value="library">
          <div className="mt-4 mb-4">
            <Input
              placeholder="Search resources…"
              value={libQuery}
              onChange={(e) => {
                setLibQuery(e.target.value);
                loadLibrary(e.target.value);
              }}
              className="max-w-sm"
            />
          </div>
          {loading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : library.length === 0 ? (
            <p className="mt-4 text-center text-muted-foreground text-sm">
              {libQuery ? `No resources matching "${libQuery}"` : "No content library items yet."}
            </p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {library.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm font-medium">{item.title}</TableCell>
                      <TableCell>
                        <TypeBadge type={item.content_type} accentColor={accentColor} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.is_public ? "Public" : "Tenant"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline"
                            style={{ color: accentColor }}
                          >
                            Open
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── MANAGE COURSES (admin only) ── */}
        {isAdmin && (
          <TabsContent value="manage">
            {loading ? (
              <Skeleton className="h-48 rounded-xl mt-4" />
            ) : allCourses.length === 0 ? (
              <p className="mt-8 text-center text-muted-foreground text-sm">
                No courses yet. Create your first course in the admin panel.
              </p>
            ) : (
              <div className="mt-4 rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Featured</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allCourses.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm font-medium">{c.title}</TableCell>
                        <TableCell>
                          <TypeBadge type={c.content_type} accentColor={accentColor} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.duration_minutes ? formatDuration(c.duration_minutes) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={c.status === "published" ? "default" : "secondary"}
                            className="text-xs"
                            style={c.status === "published" ? { backgroundColor: accentColor, color: "#fff" } : {}}
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.is_featured ? "Yes" : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const TYPE_LABELS: Record<string, string> = {
  "e-learning": "E-Learning",
  video: "Video",
  document: "Document",
  assessment: "Assessment",
  external: "External",
  blended: "Blended",
};

function TypeBadge({ type, accentColor }: { type: string; accentColor: string }) {
  return (
    <Badge variant="outline" className="text-xs" style={{ borderColor: accentColor, color: accentColor }}>
      {TYPE_LABELS[type] ?? type}
    </Badge>
  );
}
