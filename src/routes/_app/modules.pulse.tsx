import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPulseCadence, setPulseCadence } from "@/lib/modules.functions";
import { BoostAgent } from "@/components/boost/BoostAgent";
import { ModulePageHeader } from "@/components/boost/ModulePageHeader";
import { Activity } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/modules/pulse")({
  head: () => ({ meta: [{ title: "Boost!Pulse · BoostMyWorkforce" }] }),
  component: PulseHome,
});

const CADENCES = ["weekly", "biweekly", "monthly", "quarterly"] as const;

function PulseHome() {
  const qc = useQueryClient();
  const getFn = useServerFn(getPulseCadence);
  const setFn = useServerFn(setPulseCadence);
  const cad = useQuery({ queryKey: ["pulse-cadence"], queryFn: () => getFn({ data: {} }) });

  const mutate = useMutation({
    mutationFn: (cadence: typeof CADENCES[number]) => setFn({ data: { cadence, active: cad.data?.active } }),
    onSuccess: () => { toast.success("Cadence updated"); qc.invalidateQueries({ queryKey: ["pulse-cadence"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <ModulePageHeader
        icon={Activity}
        name="Boost!Pulse"
        tagline="Run employee engagement surveys on a cadence that fits your team."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-md bg-accent/15">
                <Activity className="h-4 w-4 text-accent-foreground" aria-hidden />
              </div>
              <h2 className="font-semibold">Survey cadence</h2>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <span className="text-sm text-muted-foreground">Current cadence</span>
              <Badge className="capitalize">{cad.data?.cadence ?? "—"}</Badge>
              <Badge variant={cad.data?.active ? "default" : "outline"}>{cad.data?.active ? "Active" : "Inactive"}</Badge>
            </div>

            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Choose a cadence</p>
            <div className="flex flex-wrap gap-2">
              {CADENCES.map((c) => (
                <Button
                  key={c} size="sm"
                  className="capitalize"
                  variant={cad.data?.cadence === c ? "default" : "outline"}
                  onClick={() => mutate.mutate(c)} disabled={mutate.isPending}
                >{c}</Button>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Launching a survey requires email confirmation from the requesting admin. Use the BOOST! agent on the right to draft and request approval.
            </p>
          </Card>
        </div>

        <BoostAgent
          moduleKey="pulse"
          intro="Hi — I'm BOOST! I'll help you pick a cadence and draft your first survey. Before launching, you'll get a confirmation email. What pace fits your team?"
        />
      </div>
    </div>
  );
}
