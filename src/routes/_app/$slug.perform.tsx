/**
 * Boost!Perform Module — /_app/$slug/perform
 *
 * Role-differentiated performance management UI:
 *   Tabs: Targets | Reviews | Kudos Wall | Conversation Coach* | Potential Ratings*
 *   (* = manager/admin only)
 *
 * Key rules enforced in UI:
 *   - Targets: use term "Targets" — never "Goals"
 *   - Kudos: flight_risk_flag never shown to anyone except super_admin
 *   - Coach sessions: download/print only — no share, no email
 *   - Manager effectiveness scores: hidden from managers, admin-only section
 *   - Potential ratings: AI insight is advisory draft — manager must explicitly save
 *
 * Brand accent: var(--boost-perform) — pink
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { useAuth } from "@/hooks/use-auth";
import {
  listTargets,
  updateTargetProgress,
  listReviews,
  listKudos,
  sendKudos,
  listCoachSessions,
  getPotentialRatings,
  getManagerEffectivenessScores,
  listTenantLearners,
} from "@/lib/perform.functions";
import { generateCoachAgenda, generatePotentialRatingInsight } from "@/lib/ai-coach.functions";

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/$slug/perform")({
  head: () => ({
    meta: [{ title: "Boost!Perform · BOOST! My WorkForce Suite" }],
  }),
  component: PerformModule,
});

// ── Types ──────────────────────────────────────────────────────────────────

type Target = {
  id: string;
  title: string;
  description: string | null;
  success_metric: string | null;
  due_date: string | null;
  progress_pct: number;
  status: "active" | "completed" | "cancelled";
  employee_id: string;
};

type Review = {
  id: string;
  employee_id: string;
  status: "draft" | "submitted" | "complete";
  rating_overall: number | null;
  created_at: string;
};

type Kudos = {
  id: string;
  message: string;
  category: string;
  is_public: boolean;
  created_at: string;
  giver?: { first_name: string; last_name: string };
  receiver?: { first_name: string; last_name: string };
};

type CoachSession = {
  id: string;
  employee_id: string;
  session_date: string;
  agenda_json: unknown;
  notes_text: string | null;
  is_completed: boolean;
};

type PotentialRating = {
  id: string;
  employee_id: string;
  learning_agility: number;
  aspiration: number;
  capability_ceiling: number;
  composite_score: number;
  potential_level: "developing" | "growth" | "high";
  narrative: string | null;
  rated_at: string;
  employee?: { first_name: string; last_name: string; job_title: string | null };
};

type Learner = { id: string; first_name: string; last_name: string; job_title: string | null };

type ManagerScore = {
  id: string;
  manager_id: string;
  score: number;
  period: string;
  notes: string | null;
  manager?: { first_name: string; last_name: string; job_title: string | null };
};

// ── Main Component ─────────────────────────────────────────────────────────

function PerformModule() {
  const { tenant, slug } = useTenant();
  const { isSuperAdmin, isBsgAdmin, isTenantAdmin, isManager } = useAuth();

  const canManage = isSuperAdmin || isBsgAdmin || isTenantAdmin || isManager;
  const isAdmin = isSuperAdmin || isBsgAdmin || isTenantAdmin;

  // Data
  const [targets, setTargets] = useState<Target[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [kudos, setKudos] = useState<Kudos[]>([]);
  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [potentialRatings, setPotentialRatings] = useState<PotentialRating[]>([]);
  const [mgrScores, setMgrScores] = useState<ManagerScore[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("targets");

  // Kudos form
  const [showKudosForm, setShowKudosForm] = useState(false);
  const [kudosReceiverId, setKudosReceiverId] = useState("");
  const [kudosMessage, setKudosMessage] = useState("");
  const [kudosCategory, setKudosCategory] = useState("Teamwork");
  const [kudosPublic, setKudosPublic] = useState(true);
  const [kudosLoading, setKudosLoading] = useState(false);

  // Coach AI
  const [coachDialogOpen, setCoachDialogOpen] = useState(false);
  const [coachSession, setCoachSession] = useState<CoachSession | null>(null);
  const [coachAgenda, setCoachAgenda] = useState<{
    agenda: string;
    talking_points: string[];
    suggested_questions: string[];
  } | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Potential rating AI
  const [potentialDialogOpen, setPotentialDialogOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState<PotentialRating | null>(null);
  const [potentialInsight, setPotentialInsight] = useState<{
    narrative: string;
    development_suggestions: string[];
    manager_coaching_tips: string[];
  } | null>(null);
  const [potentialLoading, setPotentialLoading] = useState(false);

  async function loadTab(tab: string) {
    if (!slug) return;
    setError(null);
    setLoading(true);
    try {
      if (tab === "targets") {
        const data = await listTargets({ slug });
        setTargets(data as Target[]);
      } else if (tab === "reviews") {
        const data = await listReviews({ slug });
        setReviews(data as Review[]);
      } else if (tab === "kudos") {
        const [k, l] = await Promise.all([
          listKudos({ slug }),
          canManage ? listTenantLearners({ slug }) : Promise.resolve([]),
        ]);
        setKudos(k as Kudos[]);
        setLearners(l as Learner[]);
      } else if (tab === "coach" && canManage) {
        const data = await listCoachSessions({ slug });
        setSessions(data as CoachSession[]);
      } else if (tab === "potential" && canManage) {
        const [ratings, scores] = await Promise.all([
          getPotentialRatings({ slug }),
          isAdmin ? getManagerEffectivenessScores({ slug }) : Promise.resolve([]),
        ]);
        setPotentialRatings(ratings as PotentialRating[]);
        setMgrScores(scores as ManagerScore[]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTab("targets");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function handleSendKudos() {
    if (!slug || !kudosReceiverId || !kudosMessage.trim()) return;
    setKudosLoading(true);
    try {
      await sendKudos({
        slug,
        receiver_id: kudosReceiverId,
        message: kudosMessage,
        category: kudosCategory as any,
        is_public: kudosPublic,
      });
      setShowKudosForm(false);
      setKudosMessage("");
      setKudosReceiverId("");
      await loadTab("kudos");
    } catch (e: any) {
      setError(e?.message ?? "Failed to send kudos");
    } finally {
      setKudosLoading(false);
    }
  }

  async function handleGenerateAgenda(session: CoachSession) {
    if (!slug) return;
    setCoachSession(session);
    setCoachDialogOpen(true);
    setCoachLoading(true);
    setCoachAgenda(null);
    try {
      const result = await generateCoachAgenda({
        slug,
        employee_id: session.employee_id,
        session_date: session.session_date,
        manager_notes: session.notes_text ?? "",
      });
      setCoachAgenda(result as any);
    } catch (e: any) {
      setError(e?.message ?? "AI agenda generation failed");
      setCoachDialogOpen(false);
    } finally {
      setCoachLoading(false);
    }
  }

  function handlePrintAgenda() {
    window.print();
  }

  async function handlePotentialInsight(rating: PotentialRating) {
    if (!slug) return;
    setSelectedRating(rating);
    setPotentialDialogOpen(true);
    setPotentialLoading(true);
    setPotentialInsight(null);
    try {
      const result = await generatePotentialRatingInsight({
        slug,
        employee_id: rating.employee_id,
        learning_agility: rating.learning_agility,
        aspiration: rating.aspiration,
        capability_ceiling: rating.capability_ceiling,
      });
      setPotentialInsight(result as any);
    } catch (e: any) {
      setError(e?.message ?? "AI insight failed");
      setPotentialDialogOpen(false);
    } finally {
      setPotentialLoading(false);
    }
  }

  const accentColor = "var(--boost-perform)";

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: accentColor }} />
        <h1 className="text-2xl font-bold text-foreground">Boost!Perform</h1>
        <Badge variant="outline" className="ml-auto text-xs" style={{ borderColor: accentColor, color: accentColor }}>
          {tenant?.name}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}{" "}
            <button className="underline ml-2" onClick={() => loadTab(activeTab)}>
              Retry
            </button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        defaultValue="targets"
        onValueChange={(v) => {
          setActiveTab(v);
          loadTab(v);
        }}
      >
        <TabsList>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="kudos">Kudos Wall</TabsTrigger>
          {canManage && <TabsTrigger value="coach">Conversation Coach</TabsTrigger>}
          {canManage && <TabsTrigger value="potential">Potential Ratings</TabsTrigger>}
        </TabsList>

        {/* ── TARGETS ── */}
        <TabsContent value="targets">
          {loading ? (
            <div className="space-y-3 mt-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : targets.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground text-sm">No targets set yet.</p>
          ) : (
            <div className="space-y-3 mt-4">
              {targets.map((t) => {
                const progressColor =
                  t.progress_pct === 100
                    ? "bg-green-500"
                    : t.progress_pct >= 50
                    ? "bg-amber-500"
                    : "bg-red-500";
                return (
                  <Card key={t.id} className="border border-border">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{t.title}</p>
                          {t.success_metric && (
                            <p className="text-xs text-muted-foreground mt-0.5">{t.success_metric}</p>
                          )}
                          {t.due_date && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Due {new Date(t.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={t.status === "completed" ? "default" : "outline"}
                          className="shrink-0 text-xs"
                          style={t.status === "completed" ? { backgroundColor: accentColor, color: "#fff" } : {}}
                        >
                          {t.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={t.progress_pct} className="flex-1 h-2" />
                        <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                          {t.progress_pct}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── REVIEWS ── */}
        <TabsContent value="reviews">
          {loading ? (
            <Skeleton className="h-48 rounded-xl mt-4" />
          ) : reviews.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground text-sm">No reviews on record.</p>
          ) : (
            <div className="mt-4 rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Overall Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={r.status === "complete" ? "default" : "secondary"}
                          className="text-xs"
                          style={r.status === "complete" ? { backgroundColor: accentColor, color: "#fff" } : {}}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {r.rating_overall != null ? r.rating_overall.toFixed(1) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── KUDOS WALL ── */}
        <TabsContent value="kudos">
          <div className="mt-4 flex justify-end mb-3">
            <Button
              size="sm"
              style={{ backgroundColor: accentColor, color: "#fff" }}
              onClick={() => {
                setShowKudosForm(true);
                if (learners.length === 0 && slug) {
                  listTenantLearners({ slug }).then((l) => setLearners(l as Learner[]));
                }
              }}
            >
              Send Kudos
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : kudos.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground text-sm">
              No kudos yet — be the first to recognize someone.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {kudos.map((k) => (
                <Card key={k.id} className="border border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs" style={{ borderColor: accentColor, color: accentColor }}>
                        {k.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(k.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-2 leading-relaxed">{k.message}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">
                        {k.giver ? `${k.giver.first_name} ${k.giver.last_name}` : "Someone"}
                      </span>{" "}
                      →{" "}
                      <span className="font-medium">
                        {k.receiver ? `${k.receiver.first_name} ${k.receiver.last_name}` : "Teammate"}
                      </span>
                    </p>
                    {/* flight_risk_flag intentionally NOT shown — admin-only, never auto-set */}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Send Kudos Dialog */}
          <Dialog open={showKudosForm} onOpenChange={setShowKudosForm}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Send Kudos</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs mb-1 block">Recognize</Label>
                  <Select value={kudosReceiverId} onValueChange={setKudosReceiverId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a teammate…" />
                    </SelectTrigger>
                    <SelectContent>
                      {learners.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.first_name} {l.last_name}
                          {l.job_title ? ` — ${l.job_title}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Category</Label>
                  <Select value={kudosCategory} onValueChange={setKudosCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Innovation", "Teamwork", "Leadership", "Going Above & Beyond"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Message (10–500 characters)</Label>
                  <Textarea
                    value={kudosMessage}
                    onChange={(e) => setKudosMessage(e.target.value)}
                    placeholder="Describe what they did and why it matters…"
                    className="resize-none"
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-right mt-1">
                    {kudosMessage.length}/500
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="kudos-public"
                    checked={kudosPublic}
                    onCheckedChange={setKudosPublic}
                  />
                  <Label htmlFor="kudos-public" className="text-xs cursor-pointer">
                    Post to Kudos Wall (visible to everyone)
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowKudosForm(false)}>Cancel</Button>
                <Button
                  style={{ backgroundColor: accentColor, color: "#fff" }}
                  disabled={kudosLoading || !kudosReceiverId || kudosMessage.trim().length < 10}
                  onClick={handleSendKudos}
                >
                  {kudosLoading ? "Sending…" : "Send Kudos"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── CONVERSATION COACH (manager/admin only) ── */}
        {canManage && (
          <TabsContent value="coach">
            {loading ? (
              <div className="space-y-3 mt-4">
                {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : sessions.length === 0 ? (
              <p className="mt-8 text-center text-muted-foreground text-sm">
                No coaching sessions on record yet.
              </p>
            ) : (
              <div className="space-y-3 mt-4">
                {sessions.map((s) => (
                  <Card key={s.id} className="border border-border">
                    <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">
                          Session — {new Date(s.session_date).toLocaleDateString()}
                        </p>
                        <Badge
                          variant={s.is_completed ? "default" : "secondary"}
                          className="mt-1 text-xs"
                          style={s.is_completed ? { backgroundColor: accentColor, color: "#fff" } : {}}
                        >
                          {s.is_completed ? "Completed" : "Pending"}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-xs"
                        onClick={() => handleGenerateAgenda(s)}
                      >
                        AI Agenda
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Coach Agenda Dialog — print/download only; NO share, NO email */}
            <Dialog open={coachDialogOpen} onOpenChange={setCoachDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    Coaching Agenda —{" "}
                    {coachSession ? new Date(coachSession.session_date).toLocaleDateString() : ""}
                  </DialogTitle>
                </DialogHeader>
                <div ref={printRef}>
                  {coachLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : coachAgenda ? (
                    <div className="space-y-4 text-sm">
                      <p className="text-muted-foreground italic">{coachAgenda.agenda}</p>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                          Talking Points
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {coachAgenda.talking_points.map((tp, i) => (
                            <li key={i}>{tp}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                          Suggested Questions
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                          {coachAgenda.suggested_questions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>

                      <p className="text-xs text-muted-foreground border-t pt-3">
                        AI-generated agenda — review before your session.
                        This note is for your use only and is not shared automatically.
                      </p>
                    </div>
                  ) : null}
                </div>
                <DialogFooter>
                  {/* Print only — no share, no email */}
                  <Button variant="outline" size="sm" onClick={handlePrintAgenda} disabled={!coachAgenda}>
                    Print / Download
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCoachDialogOpen(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}

        {/* ── POTENTIAL RATINGS (manager/admin only) ── */}
        {canManage && (
          <TabsContent value="potential">
            {loading ? (
              <Skeleton className="h-48 rounded-xl mt-4" />
            ) : potentialRatings.length === 0 ? (
              <p className="mt-8 text-center text-muted-foreground text-sm">
                No potential ratings on record.
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                  {potentialRatings.map((r) => (
                    <Card key={r.id} className="border border-border">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">
                              {r.employee
                                ? `${r.employee.first_name} ${r.employee.last_name}`
                                : "Employee"}
                            </p>
                            {r.employee?.job_title && (
                              <p className="text-xs text-muted-foreground">{r.employee.job_title}</p>
                            )}
                          </div>
                          <PotentialBadge level={r.potential_level} />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-muted-foreground mb-3">
                          Score: {r.composite_score?.toFixed(2) ?? "—"} ·{" "}
                          {new Date(r.rated_at).toLocaleDateString()}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs"
                          onClick={() => handlePotentialInsight(r)}
                        >
                          AI Insight
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Manager Effectiveness — admin-only, hidden from managers */}
                {isAdmin && mgrScores.length > 0 && (
                  <div className="mt-8">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                      Manager Effectiveness Scores — Admin View
                    </p>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Manager</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mgrScores.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="text-sm font-medium">
                                {s.manager
                                  ? `${s.manager.first_name} ${s.manager.last_name}`
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-sm">{s.period}</TableCell>
                              <TableCell className="text-sm font-mono">{s.score?.toFixed(1)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                                {s.notes ?? "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Potential Insight Dialog — advisory only, must explicitly save */}
            <Dialog open={potentialDialogOpen} onOpenChange={setPotentialDialogOpen}>
              <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    Potential Insight —{" "}
                    {selectedRating?.employee
                      ? `${selectedRating.employee.first_name} ${selectedRating.employee.last_name}`
                      : "Employee"}
                  </DialogTitle>
                </DialogHeader>
                {potentialLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : potentialInsight ? (
                  <div className="space-y-4 text-sm">
                    <p className="leading-relaxed">{potentialInsight.narrative}</p>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Development Suggestions
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {potentialInsight.development_suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Manager Coaching Tips
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {potentialInsight.manager_coaching_tips.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>

                    <p className="text-xs text-muted-foreground border-t pt-3">
                      This is an AI-generated advisory insight. Potential is dynamic, not fixed.
                      Review before saving to the employee's record.
                    </p>
                  </div>
                ) : null}
                <DialogFooter>
                  <Button variant="ghost" size="sm" onClick={() => setPotentialDialogOpen(false)}>
                    Discard
                  </Button>
                  {/* Explicit save required — never auto-applied */}
                  <Button
                    size="sm"
                    style={{ backgroundColor: accentColor, color: "#fff" }}
                    disabled={!potentialInsight}
                    onClick={() => {
                      // TODO: persist narrative to potential_ratings via server fn
                      setPotentialDialogOpen(false);
                    }}
                  >
                    Save Rating Note
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PotentialBadge({ level }: { level: "developing" | "growth" | "high" }) {
  const map = {
    high: { label: "High Potential", color: "var(--boost-perform)" },
    growth: { label: "Growth", color: "var(--boost-pulse)" },
    developing: { label: "Developing", color: "var(--boost-roles)" },
  };
  const { label, color } = map[level];
  return (
    <Badge variant="outline" className="text-xs shrink-0" style={{ borderColor: color, color }}>
      {label}
    </Badge>
  );
}
