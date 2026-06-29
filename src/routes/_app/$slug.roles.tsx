/**
 * Boost!Roles Module — /_app/$slug/roles
 *
 * Role-differentiated UI for job architecture:
 *   super_admin / bsg_admin / tenant_admin / admin / manager → full management view
 *   learner / instructor / mentor → published JDs + career ladders only
 *
 * Brand accent: var(--boost-roles) — orange
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { useAuth } from "@/hooks/use-auth";
import {
  listJobDescriptions,
  listPayBands,
  listCareerLadders,
  searchNaicsCodes,
  getPromotionReadiness,
  publishJobDescription,
} from "@/lib/roles.functions";
import { generateJobDescription } from "@/lib/ai-jd.functions";

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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/$slug/roles")({
  head: () => ({
    meta: [{ title: "Boost!Roles · BOOST! My WorkForce Suite" }],
  }),
  component: RolesModule,
});

// ── Types ──────────────────────────────────────────────────────────────────

type JD = {
  id: string;
  title: string;
  department: string;
  naics_code: string | null;
  status: "draft" | "published";
  created_at: string;
  pay_band?: { title: string; level: number; min_salary: number; max_salary: number; currency: string } | null;
};

type PayBand = {
  id: string;
  title: string;
  level: number;
  min_salary: number;
  max_salary: number;
  currency: string;
};

type CareerLadder = {
  id: string;
  department: string;
  title: string;
  levels_json: unknown;
};

type PromoRecord = {
  id: string;
  employee_id: string;
  readiness_score: number;
  notes: string | null;
  assessed_at: string;
};

type AiDraftResult = {
  title: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  preferred_qualifications: string[];
  dei_statement: string;
} | null;

// ── Main Component ─────────────────────────────────────────────────────────

function RolesModule() {
  const { tenant, slug } = useTenant();
  const { isSuperAdmin, isBsgAdmin, isTenantAdmin, isManager } = useAuth();

  const canManage = isSuperAdmin || isBsgAdmin || isTenantAdmin || isManager;

  // Data state
  const [jds, setJds] = useState<JD[]>([]);
  const [payBands, setPayBands] = useState<PayBand[]>([]);
  const [ladders, setLadders] = useState<CareerLadder[]>([]);
  const [promos, setPromos] = useState<PromoRecord[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("jds");
  const [aiDraft, setAiDraft] = useState<AiDraftResult>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDialogJd, setAiDialogJd] = useState<string | null>(null); // JD title for dialog

  // Load data on tab change
  async function loadTab(tab: string) {
    if (!slug) return;
    setError(null);
    setLoading(true);
    try {
      if (tab === "jds") {
        const data = await listJobDescriptions({ slug, includeAll: canManage });
        setJds(data as JD[]);
      } else if (tab === "paybands" && canManage) {
        const data = await listPayBands({ slug });
        setPayBands(data as PayBand[]);
      } else if (tab === "ladders") {
        const data = await listCareerLadders({ slug });
        setLadders(data as CareerLadder[]);
      } else if (tab === "promo" && canManage) {
        const data = await getPromotionReadiness({ slug });
        setPromos(data as PromoRecord[]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  // Load JDs on mount
  useEffect(() => {
    loadTab("jds");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function handlePublish(jdId: string) {
    if (!slug) return;
    try {
      await publishJobDescription({ jd_id: jdId, slug });
      await loadTab("jds");
    } catch (e: any) {
      setError(e?.message ?? "Publish failed");
    }
  }

  async function handleAiDraft(jd: JD) {
    if (!slug) return;
    setAiLoading(true);
    setAiDraft(null);
    setAiDialogJd(jd.title);
    try {
      const result = await generateJobDescription({
        slug,
        job_title: jd.title,
        department: jd.department,
        pay_band_id: jd.pay_band?.title ?? "",
        naics_code: jd.naics_code ?? "",
        responsibilities: [],
        required_skills: [],
        nice_to_have: [],
      });
      setAiDraft(result as AiDraftResult);
    } catch (e: any) {
      setError(e?.message ?? "AI draft failed");
    } finally {
      setAiLoading(false);
    }
  }

  const accentColor = "var(--boost-roles)";

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: accentColor }} />
        <h1 className="text-2xl font-bold text-foreground">Boost!Roles</h1>
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
        defaultValue="jds"
        onValueChange={(v) => {
          setActiveTab(v);
          loadTab(v);
        }}
      >
        <TabsList>
          <TabsTrigger value="jds">Job Descriptions</TabsTrigger>
          {canManage && <TabsTrigger value="paybands">Pay Bands</TabsTrigger>}
          <TabsTrigger value="ladders">Career Ladders</TabsTrigger>
          {canManage && <TabsTrigger value="promo">Promotion Readiness</TabsTrigger>}
        </TabsList>

        {/* ── Job Descriptions ── */}
        <TabsContent value="jds">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : jds.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground text-sm">
              No job descriptions yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
              {jds.map((jd) => (
                <Card key={jd.id} className="border border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold leading-tight">{jd.title}</CardTitle>
                      <Badge
                        variant={jd.status === "published" ? "default" : "secondary"}
                        className="shrink-0 text-xs"
                        style={jd.status === "published" ? { backgroundColor: accentColor, color: "#fff" } : {}}
                      >
                        {jd.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{jd.department}</p>
                    {jd.pay_band && (
                      <p className="text-xs text-muted-foreground">
                        {jd.pay_band.title} · {jd.pay_band.currency}{" "}
                        {jd.pay_band.min_salary.toLocaleString()}–
                        {jd.pay_band.max_salary.toLocaleString()}
                      </p>
                    )}
                    {jd.naics_code && (
                      <p className="text-xs text-muted-foreground">NAICS {jd.naics_code}</p>
                    )}
                  </CardHeader>
                  {canManage && (
                    <CardContent className="pt-0 flex gap-2 flex-wrap">
                      {jd.status === "draft" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => handlePublish(jd.id)}
                        >
                          Publish
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        disabled={aiLoading}
                        onClick={() => handleAiDraft(jd)}
                      >
                        AI Draft
                      </Button>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Pay Bands ── */}
        {canManage && (
          <TabsContent value="paybands">
            {loading ? (
              <Skeleton className="h-48 rounded-xl mt-4" />
            ) : payBands.length === 0 ? (
              <p className="mt-8 text-center text-muted-foreground text-sm">
                No pay bands configured. Contact your BSG administrator.
              </p>
            ) : (
              <div className="mt-4 rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Level</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Min Salary</TableHead>
                      <TableHead>Max Salary</TableHead>
                      <TableHead>Currency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payBands.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-sm">{b.level}</TableCell>
                        <TableCell className="font-medium text-sm">{b.title}</TableCell>
                        <TableCell className="text-sm">{b.min_salary.toLocaleString()}</TableCell>
                        <TableCell className="text-sm">{b.max_salary.toLocaleString()}</TableCell>
                        <TableCell className="text-sm uppercase">{b.currency}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

        {/* ── Career Ladders ── */}
        <TabsContent value="ladders">
          {loading ? (
            <Skeleton className="h-48 rounded-xl mt-4" />
          ) : ladders.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground text-sm">
              No career ladders configured yet.
            </p>
          ) : (
            <Accordion type="multiple" className="mt-4 space-y-2">
              {ladders.map((l) => (
                <AccordionItem key={l.id} value={l.id} className="border border-border rounded-xl px-4">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    {l.department} — {l.title}
                  </AccordionTrigger>
                  <AccordionContent>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                      {typeof l.levels_json === "string"
                        ? l.levels_json
                        : JSON.stringify(l.levels_json, null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        {/* ── Promotion Readiness ── */}
        {canManage && (
          <TabsContent value="promo">
            {loading ? (
              <Skeleton className="h-48 rounded-xl mt-4" />
            ) : promos.length === 0 ? (
              <p className="mt-8 text-center text-muted-foreground text-sm">
                No promotion readiness assessments on record.
              </p>
            ) : (
              <div className="mt-4 rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Readiness Score</TableHead>
                      <TableHead>Assessed</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm font-mono">{p.employee_id.slice(0, 8)}…</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: p.readiness_score >= 4 ? "var(--color-success)" : p.readiness_score >= 2 ? "var(--boost-roles)" : "var(--color-destructive)",
                              color: p.readiness_score >= 4 ? "var(--color-success)" : p.readiness_score >= 2 ? "var(--boost-roles)" : "var(--color-destructive)",
                            }}
                          >
                            {p.readiness_score}/5
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(p.assessed_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {p.notes ?? "—"}
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

      {/* AI Draft Dialog */}
      <Dialog open={!!aiDraft || aiLoading} onOpenChange={() => { setAiDraft(null); setAiDialogJd(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Job Description Draft — {aiDialogJd}</DialogTitle>
          </DialogHeader>
          {aiLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : aiDraft ? (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground italic">{aiDraft.summary}</p>
              <Section label="Responsibilities" items={aiDraft.responsibilities} />
              <Section label="Requirements" items={aiDraft.requirements} />
              <Section label="Preferred Qualifications" items={aiDraft.preferred_qualifications} />
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">DEI Statement</p>
                <p>{aiDraft.dei_statement}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                This is an AI-generated draft. Review and edit before publishing.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">{label}</p>
      <ul className="list-disc list-inside space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm">{item}</li>
        ))}
      </ul>
    </div>
  );
}
