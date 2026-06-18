import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listQuestions, upsertQuestion, deleteQuestion, bulkImportQuestions, draftQuestionWithAI } from "@/lib/admin-questions.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTENT_AREAS, areaShort, type ContentAreaKey } from "@/lib/exam";
import { toast } from "sonner";
import { Pencil, Plus, Sparkles, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_app/admin/questions")({
  head: () => ({ meta: [{ title: "Question bank · Admin" }] }),
  component: QuestionsAdmin;
});

type Row = Awaited<ReturnType<typeof listQuestions>>[number];

function QuestionsAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listQuestions);
  const [area, setArea] = useState<ContentAreaKey | "all">("all");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<Row> | null>(null);

  const query = useQuery({
    queryKey: ["admin", "questions", area, status, q],
    queryFn: () => list({ data: { area: area === "all" ? undefined : area, status, q: q || undefined } }),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Question bank</h1>
          <p className="text-muted-foreground">Manage the LCSW item bank. Drafts stay hidden from students until published.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CsvImportButton onDone={() => qc.invalidateQueries({ queryKey: ["admin", "questions"] })} />
          <AiDraftButton onDone={() => qc.invalidateQueries({ queryKey: ["admin", "questions"] })} />
          <Button onClick={() => setEditing({ content_area: "human_development", choices: ["", "", "", ""], correct_index: 0, status: "draft", difficulty: 2 })}>
            <Plus className="h-4 w-4" /> New question
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Search</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stems…" />
          </div>
          <div>
            <Label className="text-xs">Area</Label>
            <Select value={area} onValueChange={(v) => setArea(v as ContentAreaKey | "all")}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All areas</SelectItem>
                {CONTENT_AREAS.map((a) => <SelectItem key={a.key} value={a.key}>{a.short}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "all" | "draft" | "published")}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : (
            <ul className="divide-y divide-border">
              {(query.data ?? []).map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-4 p-4 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant={row.status === "published" ? "default" : "secondary"} className="capitalize">{row.status}</Badge>
                      <span className="text-xs text-muted-foreground">{areaShort(row.content_area)}{row.sub_topic ? ` · ${row.sub_topic}` : ""} · difficulty {row.difficulty}</span>
                    </div>
                    <p className="line-clamp-2 text-sm">{row.stem}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(row)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <DeleteButton id={row.id} onDone={() => qc.invalidateQueries({ queryKey: ["admin", "questions"] })} />
                  </div>
                </li>
              ))}
              {!query.isLoading && (query.data ?? []).length === 0 && (
                <li className="p-8 text-center text-sm text-muted-foreground">No questions match. Try a different filter or add one.</li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <QuestionDialog
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["admin", "questions"] }); }}
      />
    </div>
  );
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const del = useServerFn(deleteQuestion);
  const m = useMutation({
    mutationFn: () => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this question?")) m.mutate(); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>;
}

function QuestionDialog({ value, onClose, onSaved }: { value: Partial<Row> | null; onClose: () => void; onSaved: () => void }) {
  const save = useServerFn(upsertQuestion);
  const [v, setV] = useState<Partial<Row>>({});
  // sync
  useState(() => { if (value) setV(value); });
  if (!value) return null;
  const cur = { ...value, ...v };
  const choices = (cur.choices as string[] | undefined) ?? ["", "", "", ""];

  async function submit() {
    try {
      await save({ data: {
        id: cur.id, content_area: cur.content_area as ContentAreaKey,
        sub_topic: cur.sub_topic ?? null, stem: cur.stem ?? "", choices,
        correct_index: cur.correct_index ?? 0, rationale: cur.rationale ?? "",
        difficulty: cur.difficulty ?? 2, source: cur.source ?? null,
        status: (cur.status as "draft" | "published") ?? "draft",
      } });
      toast.success("Saved");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{cur.id ? "Edit question" : "New question"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Content area</Label>
              <Select value={cur.content_area as string} onValueChange={(val) => setV({ ...cur, content_area: val as ContentAreaKey })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTENT_AREAS.map((a) => <SelectItem key={a.key} value={a.key}>{a.short}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sub-topic</Label>
              <Input value={cur.sub_topic ?? ""} onChange={(e) => setV({ ...cur, sub_topic: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Stem</Label>
            <Textarea rows={4} value={cur.stem ?? ""} onChange={(e) => setV({ ...cur, stem: e.target.value })} />
          </div>
          {choices.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <input type="radio" checked={cur.correct_index === i} onChange={() => setV({ ...cur, correct_index: i })} className="mt-3" aria-label={`Mark choice ${String.fromCharCode(65 + i)} correct`} />
              <div className="flex-1">
                <Label>Choice {String.fromCharCode(65 + i)}{cur.correct_index === i && <span className="ml-2 text-success">✓ correct</span>}</Label>
                <Input value={c} onChange={(e) => { const next = [...choices]; next[i] = e.target.value; setV({ ...cur, choices: next }); }} />
              </div>
            </div>
          ))}
          <div>
            <Label>Rationale</Label>
            <Textarea rows={3} value={cur.rationale ?? ""} onChange={(e) => setV({ ...cur, rationale: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Difficulty (1–5)</Label>
              <Input type="number" min={1} max={5} value={cur.difficulty ?? 2} onChange={(e) => setV({ ...cur, difficulty: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Source</Label>
              <Input value={cur.source ?? ""} onChange={(e) => setV({ ...cur, source: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={cur.status as string ?? "draft"} onValueChange={(val) => setV({ ...cur, status: val as "draft" | "published" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiDraftButton({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState<ContentAreaKey>("ethics_values");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const draft = useServerFn(draftQuestionWithAI);
  const m = useMutation({
    mutationFn: () => draft({ data: { content_area: area, sub_topic: topic, difficulty } }),
    onSuccess: () => { toast.success("Draft created — review in the list."); setOpen(false); setTopic(""); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="gap-2"><Sparkles className="h-4 w-4" /> AI draft</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>AI-draft a question</DialogTitle></DialogHeader>
        <CardDescription>Generates an original draft you can review and publish. Never reproduces copyrighted ASWB items.</CardDescription>
        <div className="space-y-3 pt-2">
          <div><Label>Content area</Label>
            <Select value={area} onValueChange={(v) => setArea(v as ContentAreaKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONTENT_AREAS.map((a) => <SelectItem key={a.key} value={a.key}>{a.short}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Sub-topic</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. duty to warn, DSM-5 anxiety disorders" /></div>
          <div><Label>Difficulty</Label><Input type="number" min={1} max={5} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} /></div>
        </div>
        <DialogFooter><Button disabled={m.isPending || !topic} onClick={() => m.mutate()}>{m.isPending ? "Drafting…" : "Generate"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CsvImportButton({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const importer = useServerFn(bulkImportQuestions);
  const m = useMutation({
    mutationFn: async () => {
      const rows = parseCsv(text);
      return importer({ data: { rows } });
    },
    onSuccess: (res) => { toast.success(`${res.inserted} imported${res.errors.length ? `, ${res.errors.length} skipped` : ""}`); setOpen(false); setText(""); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="gap-2"><Upload className="h-4 w-4" /> CSV import</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Bulk import questions</DialogTitle></DialogHeader>
        <CardDescription>Paste CSV with header: <code className="text-xs">content_area,sub_topic,stem,choice_a,choice_b,choice_c,choice_d,correct_index,rationale,difficulty,source,status</code></CardDescription>
        <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder="content_area,sub_topic,stem,choice_a,..." className="font-mono text-xs" />
        <DialogFooter><Button disabled={m.isPending || !text} onClick={() => m.mutate()}>{m.isPending ? "Importing…" : "Import"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Minimal CSV parser that handles quoted fields.
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = splitCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h.trim()] = (cells[i] ?? "").trim(); });
    return obj;
  });
}
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === ",") { out.push(cur); cur = ""; }
      else if (ch === '"') inQ = true;
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}
