import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { submitActivityAndGenerate } from "@/lib/ai-factory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

type Field = { key: string; label: string; type?: "text" | "textarea" | "number"; placeholder?: string; required?: boolean };

export function ActivityRunner({ activityId, enrollmentId }: { activityId: string; enrollmentId: string }) {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitActivityAndGenerate);

  const { data: activity, isLoading } = useQuery({
    queryKey: ["activity", activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id, title, prompt, schema, work_product_ids")
        .eq("id", activityId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const { data: previous } = useQuery({
    queryKey: ["activity-response", activityId, enrollmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_responses")
        .select("id, response, ai_output, submitted_at")
        .eq("activity_id", activityId)
        .eq("enrollment_id", enrollmentId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const fields: Field[] = (activity?.schema as { fields?: Field[] } | null)?.fields ?? [];
  const [values, setValues] = useState<Record<string, string>>({});

  const mut = useMutation({
    mutationFn: () => submitFn({ data: { activityId, enrollmentId, response: values } }),
    onSuccess: () => {
      toast.success("Submitted — your work product is being generated.");
      qc.invalidateQueries({ queryKey: ["activity-response", activityId, enrollmentId] });
      qc.invalidateQueries({ queryKey: ["vault"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading activity…</p>;
  if (!activity) {
    return (
      <div className="rounded-md border bg-muted/40 p-4 text-sm">
        Activity not found. Open the builder and set <code>content.activity_id</code> on this lesson.
      </div>
    );
  }

  const generated = (previous?.ai_output ?? null) as Array<{ title: string; content: { sections?: Array<{ heading?: string; body?: string }> } }> | null;

  return (
    <div className="space-y-4">
      {activity.prompt && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{activity.prompt}</div>
      )}

      {!fields.length && (
        <p className="text-xs text-muted-foreground">No input fields configured for this activity yet.</p>
      )}

      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
            {f.type === "textarea" ? (
              <Textarea
                rows={4}
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            ) : (
              <Input
                type={f.type === "number" ? "number" : "text"}
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>

      {fields.length > 0 && (
        <Button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || fields.some((f) => f.required && !values[f.key]?.trim())}
        >
          {mut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="mr-2 h-4 w-4" /> Submit & generate work product</>}
        </Button>
      )}

      {generated && generated.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="text-xs text-muted-foreground">Last submitted {previous?.submitted_at ? new Date(previous.submitted_at).toLocaleString() : ""}</div>
          {generated.map((wp, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> {wp.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {(wp.content?.sections ?? []).map((s, j) => (
                  <div key={j}>
                    {s.heading && <h4 className="font-medium mb-1">{s.heading}</h4>}
                    <p className="whitespace-pre-wrap text-muted-foreground">{s.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground">Saved to your Student Vault.</p>
        </div>
      )}
    </div>
  );
}
