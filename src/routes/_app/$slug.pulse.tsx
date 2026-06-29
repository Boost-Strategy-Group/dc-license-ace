/**
 * Boost!Pulse Module — /_app/$slug/pulse
 *
 * Learner view: active survey Likert card, already-responded state, no-survey empty state.
 * Admin/Manager view (tabbed):
 *   Surveys | Results | AI Insights | Dimension Reference
 *
 * Key rules enforced in UI:
 *   - Anonymity: if response_count < threshold, results are hidden — no partial data shown
 *   - AI insights: status='draft' until admin explicitly publishes — draft visible to admin only
 *   - No individual identification in any view
 *
 * Brand accent: var(--boost-pulse) — purple
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { useAuth } from "@/hooks/use-auth";
import {
  listPulseSurveys,
  getActiveSurveyForLearner,
  submitSurveyResponse,
  getDimensionScores,
  getPulseInsights,
  publishPulseInsight,
  listDimensions,
} from "@/lib/pulse.functions";
import { generatePulseInsights } from "@/lib/ai-pulse.functions";

// ── Shadcn/ui ──────────────────────────────────────────────────────────────
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/$slug/pulse")({
  head: () => ({
    meta: [{ title: "Boost!Pulse · BOOST! My WorkForce Suite" }],
  }),
  component: PulseModule,
});

// ── Types ──────────────────────────────────────────────────────────────────

type PulseSurvey = {
  id: string;
  title: string;
  status: "draft" | "active" | "closed";
  start_date: string | null;
  end_date: string | null;
  anonymity_threshold: number;
  created_at: string;
  template?: { title: string } | null;
};

type PulseQuestion = {
  id: string;
  question_text: string;
  scale_type: "likert5" | "likert7" | "text";
  sort_order: number;
  dimension?: { name: string; category: string } | null;
};

type ActiveSurveyResult = {
  survey: PulseSurvey & { questions: PulseQuestion[] };
  already_responded: boolean;
} | null;

type DimensionScore = {
  id: string;
  dimension_id: string;
  avg_score: number;
  response_count: number;
  computed_at: string;
  dimension?: { name: string; category: string; description?: string } | null;
};

type PulseInsight = {
  id: string;
  survey_id: string;
  insight_type: string;
  content_json: Record<string, unknown>;
  model_used: string | null;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
};

type PulseDimension = {
  id: string;
  name: string;
  category: string;
  description: string | null;
};

type AnswerMap = Record<string, { score?: number; text_answer?: string }>;

// ── Main Component ─────────────────────────────────────────────────────────

function PulseModule() {
  const { tenant, slug } = useTenant();
  const { isSuperAdmin, isBsgAdmin, isTenantAdmin, isManager } = useAuth();

  const isPrivileged = isSuperAdmin || isBsgAdmin || isTenantAdmin;
  const canManage = isPrivileged || isManager;

  // Learner view
  const [activeSurvey, setActiveSurvey] = useState<ActiveSurveyResult>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Admin tabs
  const [surveys, setSurveys] = useState<PulseSurvey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [dimScores, setDimScores] = useState<{ scores: DimensionScore[]; threshold: number; total_responses: number; below_threshold: boolean } | null>(null);
  const [insights, setInsights] = useState<PulseInsight[]>([]);
  const [dimensions, setDimensions] = useState<PulseDimension[]>([]);

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("survey");
  const [aiInsightLoading, setAiInsightLoading] = useState<string | null>(null);

  // Load active survey for learner on mount
  useEffect(() => {
    if (!slug) return;
    if (!canManage) {
      loadLearnerSurvey();
    } else {
      loadTab("surveys");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function loadLearnerSurvey() {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getActiveSurveyForLearner({ slug });
      setActiveSurvey(result as ActiveSurveyResult);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load survey");
    } finally {
      setLoading(false);
    }
  }

  async function loadTab(tab: string) {
    if (!slug) return;
    setError(null);
    setLoading(true);
    try {
      if (tab === "surveys") {
        const data = await listPulseSurveys({ slug, includeAll: true });
        setSurveys(data as PulseSurvey[]);
      } else if (tab === "results" && selectedSurveyId) {
        const data = await getDimensionScores({ slug, survey_id: selectedSurveyId });
        setDimScores(data as any);
      } else if (tab === "insights" && selectedSurveyId) {
        const data = await getPulseInsights({ slug, survey_id: selectedSurveyId });
        setInsights(data as PulseInsight[]);
      } else if (tab === "dimref") {
        const data = await listDimensions();
        setDimensions(data as PulseDimension[]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitSurvey() {
    if (!activeSurvey || !slug) return;
    const survey = activeSurvey.survey;
    const answerList = survey.questions.map((q) => ({
      question_id: q.id,
      score: answers[q.id]?.score,
      text_answer: answers[q.id]?.text_answer,
    }));

    setSubmitting(true);
    setError(null);
    try {
      await submitSurveyResponse({ survey_id: survey.id, slug, answers: answerList });
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to submit survey");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublishInsight(insightId: string) {
    if (!slug) return;
    try {
      await publishPulseInsight({ insight_id: insightId, slug });
      if (selectedSurveyId) await loadTab("insights");
    } catch (e: any) {
      setError(e?.message ?? "Failed to publish insight");
    }
  }

  async function handleGenerateInsight(surveyId: string) {
    if (!slug) return;
    setAiInsightLoading(surveyId);
    try {
      await generatePulseInsights({ slug, survey_id: surveyId });
      if (selectedSurveyId) await loadTab("insights");
    } catch (e: any) {
      setError(e?.message ?? "AI insight generation failed");
    } finally {
      setAiInsightLoading(null);
    }
  }

  const allQuestionsAnswered =
    activeSurvey &&
    activeSurvey.survey.questions.every((q) => {
      const a = answers[q.id];
      if (q.scale_type === "text") return true; // text is optional
      return a?.score != null;
    });

  const accentColor = "var(--boost-pulse)";

  // ── LEARNER VIEW ──────────────────────────────────────────────────────────
  if (!canManage) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: accentColor }} />
          <h1 className="text-2xl font-bold text-foreground">Boost!Pulse</h1>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}{" "}
              <button className="underline ml-2" onClick={loadLearnerSurvey}>
                Retry
              </button>
            </AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!loading && !activeSurvey && !error && (
          <Card className="border border-border">
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-sm text-muted-foreground">
                No active surveys right now. Check back soon.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && activeSurvey?.already_responded && (
          <Card className="border border-border">
            <CardContent className="pt-8 pb-8 text-center">
              <div
                className="mx-auto mb-3 h-10 w-10 rounded-full flex items-center justify-center text-white text-lg font-bold"
                style={{ backgroundColor: accentColor }}
              >
                ✓
              </div>
              <p className="font-semibold text-sm">Response recorded</p>
              <p className="text-xs text-muted-foreground mt-1">
                You've already completed "{activeSurvey.survey.title}". Thank you.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && submitted && (
          <Card className="border border-border">
            <CardContent className="pt-8 pb-8 text-center">
              <div
                className="mx-auto mb-3 h-10 w-10 rounded-full flex items-center justify-center text-white text-lg font-bold"
                style={{ backgroundColor: accentColor }}
              >
                ✓
              </div>
              <p className="font-semibold text-sm">Thank you for responding</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your response is anonymous and has been recorded.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && activeSurvey && !activeSurvey.already_responded && !submitted && (
          <ActiveSurveyCard
            survey={activeSurvey.survey}
            answers={answers}
            onAnswer={(qId, val) => setAnswers((prev) => ({ ...prev, [qId]: val }))}
            onSubmit={handleSubmitSurvey}
            submitting={submitting}
            allAnswered={!!allQuestionsAnswered}
            accentColor={accentColor}
          />
        )}
      </div>
    );
  }

  // ── ADMIN/MANAGER VIEW ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: accentColor }} />
        <h1 className="text-2xl font-bold text-foreground">Boost!Pulse</h1>
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
        defaultValue="surveys"
        onValueChange={(v) => {
          setActiveTab(v);
          loadTab(v);
        }}
      >
        <TabsList>
          <TabsTrigger value="surveys">Surveys</TabsTrigger>
          <TabsTrigger value="results" disabled={!selectedSurveyId}>
            Results
          </TabsTrigger>
          <TabsTrigger value="insights" disabled={!selectedSurveyId}>
            AI Insights
          </TabsTrigger>
          <TabsTrigger value="dimref">Dimension Reference</TabsTrigger>
        </TabsList>

        {/* ── SURVEYS ── */}
        <TabsContent value="surveys">
          {loading ? (
            <div className="space-y-3 mt-4">
              {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : surveys.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground text-sm">
              No surveys yet. Contact your BSG administrator to configure survey templates.
            </p>
          ) : (
            <div className="space-y-3 mt-4">
              {surveys.map((s) => (
                <Card
                  key={s.id}
                  className={`border cursor-pointer transition-shadow hover:shadow-md ${
                    selectedSurveyId === s.id ? "border-[var(--boost-pulse)]" : "border-border"
                  }`}
                  onClick={() => {
                    setSelectedSurveyId(s.id);
                  }}
                >
                  <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{s.title}</p>
                      {s.template && (
                        <p className="text-xs text-muted-foreground">Template: {s.template.title}</p>
                      )}
                      {s.start_date && s.end_date && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.start_date).toLocaleDateString()} –{" "}
                          {new Date(s.end_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={s.status === "active" ? "default" : "secondary"}
                        className="text-xs shrink-0"
                        style={s.status === "active" ? { backgroundColor: accentColor, color: "#fff" } : {}}
                      >
                        {s.status}
                      </Badge>
                      {isPrivileged && s.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs shrink-0"
                          disabled={aiInsightLoading === s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateInsight(s.id);
                          }}
                        >
                          {aiInsightLoading === s.id ? "Generating…" : "Generate Insight"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── RESULTS ── */}
        <TabsContent value="results">
          {!selectedSurveyId ? (
            <p className="mt-8 text-center text-muted-foreground text-sm">
              Select a survey from the Surveys tab first.
            </p>
          ) : loading ? (
            <Skeleton className="h-48 rounded-xl mt-4" />
          ) : dimScores?.below_threshold ? (
            <Card className="mt-4 border border-border">
              <CardContent className="pt-8 pb-8 text-center">
                <p className="font-semibold text-sm">Results unavailable</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum {dimScores.threshold} responses required to display results.{" "}
                  {dimScores.total_responses} received so far.
                  {/* Anonymity enforced — never show partial data */}
                </p>
              </CardContent>
            </Card>
          ) : dimScores && dimScores.scores.length > 0 ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{dimScores.total_responses} responses · Min threshold: {dimScores.threshold}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dimScores.scores.map((s) => (
                  <ScoreCard key={s.id} score={s} accentColor={accentColor} />
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-8 text-center text-muted-foreground text-sm">
              No dimension scores computed yet for this survey.
            </p>
          )}
        </TabsContent>

        {/* ── AI INSIGHTS ── */}
        <TabsContent value="insights">
          {!selectedSurveyId ? (
            <p className="mt-8 text-center text-muted-foreground text-sm">
              Select a survey from the Surveys tab first.
            </p>
          ) : loading ? (
            <div className="space-y-3 mt-4">
              {[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : insights.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground text-sm">
              No AI insights generated yet. Use "Generate Insight" on an active survey.
            </p>
          ) : (
            <div className="space-y-4 mt-4">
              {insights.map((insight) => {
                const content = insight.content_json as any;
                return (
                  <Card key={insight.id} className="border border-border">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-sm capitalize">{insight.insight_type}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Generated {new Date(insight.created_at).toLocaleDateString()}
                            {insight.model_used ? ` · ${insight.model_used}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant={insight.status === "published" ? "default" : "secondary"}
                            className="text-xs"
                            style={insight.status === "published" ? { backgroundColor: accentColor, color: "#fff" } : {}}
                          >
                            {insight.status}
                          </Badge>
                          {/* Publish gate — admin/privileged only, draft → published explicitly */}
                          {isPrivileged && insight.status === "draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => handlePublishInsight(insight.id)}
                            >
                              Publish
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {content?.summary && (
                        <p className="text-sm mb-3 leading-relaxed">{content.summary}</p>
                      )}
                      {content?.strengths && content.strengths.length > 0 && (
                        <InsightList label="Strengths" items={content.strengths} />
                      )}
                      {content?.opportunities && content.opportunities.length > 0 && (
                        <InsightList label="Opportunities" items={content.opportunities} />
                      )}
                      {content?.recommended_actions && content.recommended_actions.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                            Recommended Actions
                          </p>
                          <div className="space-y-1">
                            {content.recommended_actions.map((a: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <PriorityDot priority={a.priority} />
                                <span>{a.action}</span>
                                {a.owner && <span className="text-muted-foreground">({a.owner})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── DIMENSION REFERENCE ── */}
        <TabsContent value="dimref">
          {loading ? (
            <Skeleton className="h-48 rounded-xl mt-4" />
          ) : dimensions.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground text-sm">
              No dimensions configured.
            </p>
          ) : (
            <div className="mt-4 rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dimension</TableHead>
                    <TableHead>Framework</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dimensions.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm font-medium">{d.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs" style={{ borderColor: accentColor, color: accentColor }}>
                          {d.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-sm">
                        {d.description ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ActiveSurveyCard({
  survey,
  answers,
  onAnswer,
  onSubmit,
  submitting,
  allAnswered,
  accentColor,
}: {
  survey: PulseSurvey & { questions: PulseQuestion[] };
  answers: AnswerMap;
  onAnswer: (qId: string, val: { score?: number; text_answer?: string }) => void;
  onSubmit: () => void;
  submitting: boolean;
  allAnswered: boolean;
  accentColor: string;
}) {
  const sortedQuestions = [...survey.questions].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Card className="border border-border">
      <CardHeader>
        <CardTitle className="text-base">{survey.title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Your responses are completely anonymous.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {sortedQuestions.map((q) => (
          <div key={q.id} className="space-y-2">
            <p className="text-sm font-medium">{q.question_text}</p>
            {q.dimension && (
              <Badge variant="outline" className="text-xs" style={{ borderColor: accentColor, color: accentColor }}>
                {q.dimension.name}
              </Badge>
            )}

            {q.scale_type === "text" ? (
              <Textarea
                placeholder="Optional response…"
                className="resize-none"
                rows={3}
                onChange={(e) => onAnswer(q.id, { text_answer: e.target.value })}
              />
            ) : (
              <LikertScale
                questionId={q.id}
                max={q.scale_type === "likert7" ? 7 : 5}
                value={answers[q.id]?.score}
                onChange={(score) => onAnswer(q.id, { score })}
                accentColor={accentColor}
              />
            )}
          </div>
        ))}

        <Button
          className="w-full"
          style={{ backgroundColor: accentColor, color: "#fff" }}
          disabled={!allAnswered || submitting}
          onClick={onSubmit}
        >
          {submitting ? "Submitting…" : "Submit Response"}
        </Button>
      </CardContent>
    </Card>
  );
}

function LikertScale({
  questionId,
  max,
  value,
  onChange,
  accentColor,
}: {
  questionId: string;
  max: 5 | 7;
  value?: number;
  onChange: (v: number) => void;
  accentColor: string;
}) {
  const labels =
    max === 5
      ? { 1: "Strongly Disagree", [max]: "Strongly Agree" }
      : { 1: "Strongly Disagree", [max]: "Strongly Agree" };

  return (
    <div>
      <RadioGroup
        value={value?.toString() ?? ""}
        onValueChange={(v) => onChange(parseInt(v))}
        className="flex gap-2"
      >
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <div key={n} className="flex flex-col items-center gap-1">
            <RadioGroupItem
              value={n.toString()}
              id={`${questionId}-${n}`}
              className="data-[state=checked]:border-[var(--boost-pulse)] data-[state=checked]:text-[var(--boost-pulse)]"
            />
            <Label htmlFor={`${questionId}-${n}`} className="text-xs text-muted-foreground cursor-pointer">
              {n}
            </Label>
          </div>
        ))}
      </RadioGroup>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-muted-foreground">{labels[1]}</span>
        <span className="text-xs text-muted-foreground">{labels[max as keyof typeof labels]}</span>
      </div>
    </div>
  );
}

function ScoreCard({ score, accentColor }: { score: DimensionScore; accentColor: string }) {
  const avg = score.avg_score;
  const pct = (avg / 5) * 100;
  const color = avg >= 4 ? "var(--boost-learn)" : avg >= 3 ? accentColor : "var(--boost-perform)";

  return (
    <Card className="border border-border">
      <CardContent className="pt-4 pb-4">
        <p className="text-sm font-semibold mb-1">
          {score.dimension?.name ?? "Dimension"}
        </p>
        {score.dimension?.category && (
          <Badge variant="outline" className="text-xs mb-3" style={{ borderColor: accentColor, color: accentColor }}>
            {score.dimension.category}
          </Badge>
        )}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-sm font-mono font-bold" style={{ color }}>
            {avg.toFixed(1)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {score.response_count} responses
        </p>
      </CardContent>
    </Card>
  );
}

function InsightList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{label}</p>
      <ul className="list-disc list-inside space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function PriorityDot({ priority }: { priority: "high" | "medium" | "low" }) {
  const colors = {
    high: "var(--boost-perform)",
    medium: "var(--boost-roles)",
    low: "var(--boost-learn)",
  };
  return (
    <span
      className="mt-0.5 shrink-0 inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: colors[priority] ?? "var(--muted)" }}
    />
  );
}
