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
import { ModulePageHeader } from "@/components/boost/ModulePageHeader";
import { Target, CalendarRange, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/modules/perform")({
  head: () => ({ meta: [{ title: "Boost!Perform · BoostMyWorkforce" }] }),
  component: PerformHome,
});

function PerformHome() {
  const qc = useQueryClient();
  const listCats = useServerFn(listGoalCategories);
  const listCycs = useServerFn(listReviewCycles);
  const cats = useQuery({ queryKey: ["goal-cats"], queryFn: () => listCats({ data: {} }) });
  const cycles = useQuery({ queryKey: ["cycles"], queryFn: () => listCycs({ data: {} }) });
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
    <div className="mx-auto max-w-6xl space-y-8">
      <ModulePageHeader
        icon={Target}
        name="Boost!Perform"
        tagline="Set goal categories, run review cycles, and track 1:1s."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-md bg-accent/15">
                <Target className="h-4 w-4 text-accent-foreground" aria-hidden />
              </div>
              <h2 className="font-semibold">Goal categories</h2>
            </div>
            <div className="mb-3 flex gap-2">
              <Input placeholder="e.g. Customer Outcomes" value={catName} onChange={(e) => setCatName(e.target.value)} />
              <Button size="sm" onClick={() => addCat.mutate()} disabled={!catName || addCat.isPending}><Plus className="h-4 w-4" /></Button>
            </div>
            {(cats.data as any)?.rows?.length ? (
              <ul className="space-y-1 text-sm">
                {(cats.data as any).rows.map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="outline">weight {c.weight}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                No categories yet.
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-md bg-accent/15">
                <CalendarRange className="h-4 w-4 text-accent-foreground" aria-hidden />
              </div>
              <h2 className="font-semibold">Review cycles</h2>
            </div>
            <div className="mb-3 flex gap-2">
              <Input placeholder="e.g. Q1 Review" value={cycName} onChange={(e) => setCycName(e.target.value)} />
              <Button size="sm" onClick={() => addCyc.mutate()} disabled={!cycName || addCyc.isPending}><Plus className="h-4 w-4" /></Button>
            </div>
            {(cycles.data as any)?.rows?.length ? (
              <ul className="space-y-1 text-sm">
                {(cycles.data as any).rows.map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="outline" className="capitalize">{c.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                No cycles yet. Drafts must be approved by email before going live.
              </div>
            )}
          </Card>
        </div>

        {canManageRoles && (
          <BoostAgent
            moduleKey="perform"
            intro="Hi — I'm BOOST! I can set up your goal categories and draft a review cycle. Before any cycle goes live, you'll get an email to confirm. Where do you want to start?"
          />
        )}
      </div>
    </div>
  );
}
