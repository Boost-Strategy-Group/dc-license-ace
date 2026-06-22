import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  listGoalCategories, createGoalCategory,
  listReviewCycles, createReviewCycle,
} from "@/lib/modules.functions";
import { BoostAgent } from "@/components/boost/BoostAgent";
import { Target, CalendarRange, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/modules/perform")({
  head: () => ({ meta: [{ title: "Boost!Perform · BoostMyWorkforce" }] }),
  component: PerformHome,
});

function PerformHome() {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["goal-cats"], queryFn: useServerFn(listGoalCategories).bind(null, { data: {} }) as any });
  const cycles = useQuery({ queryKey: ["cycles"], queryFn: useServerFn(listReviewCycles).bind(null, { data: {} }) as any });
  const createCat = useServerFn(createGoalCategory);
  const createCyc = useServerFn(createReviewCycle);

  const [catName, setCatName] = useState("");
  const [cycName, setCycName] = useState("");

  const addCat = useMutation({
    mutationFn: () => createCat({ data: { name: catName, weight: 1 } }),
    onSuccess: () => { toast.success("Category added"); setCatName(""); qc.invalidateQueries({ queryKey: ["goal-cats"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const addCyc = useMutation({
    mutationFn: () => createCyc({ data: { name: cycName } }),
    onSuccess: () => { toast.success("Cycle drafted"); setCycName(""); qc.invalidateQueries({ queryKey: ["cycles"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Boost!Perform</h1>
        <p className="text-muted-foreground">Goal categories, review cycles, and 1:1s.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3"><Target className="h-4 w-4" /><h2 className="font-semibold">Goal categories</h2></div>
            <div className="flex gap-2 mb-3">
              <Input placeholder="e.g. Customer Outcomes" value={catName} onChange={(e) => setCatName(e.target.value)} />
              <Button size="sm" onClick={() => addCat.mutate()} disabled={!catName || addCat.isPending}><Plus className="h-4 w-4" /></Button>
            </div>
            {(cats.data as any)?.rows?.length ? (
              <ul className="divide-y text-sm">
                {(cats.data as any).rows.map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <span>{c.name}</span>
                    <Badge variant="outline">weight {c.weight}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No categories yet.</p>}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3"><CalendarRange className="h-4 w-4" /><h2 className="font-semibold">Review cycles</h2></div>
            <div className="flex gap-2 mb-3">
              <Input placeholder="e.g. Q1 Review" value={cycName} onChange={(e) => setCycName(e.target.value)} />
              <Button size="sm" onClick={() => addCyc.mutate()} disabled={!cycName || addCyc.isPending}><Plus className="h-4 w-4" /></Button>
            </div>
            {(cycles.data as any)?.rows?.length ? (
              <ul className="divide-y text-sm">
                {(cycles.data as any).rows.map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <span>{c.name}</span>
                    <Badge variant="outline">{c.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No cycles yet. Drafts must be approved by email before going live.</p>}
          </Card>
        </div>

        <BoostAgent
          moduleKey="perform"
          intro="Hi — I'm BOOST! I can set up your goal categories and draft a review cycle. Before any cycle goes live, you'll get an email to confirm. Where do you want to start?"
        />
      </div>
    </div>
  );
}
