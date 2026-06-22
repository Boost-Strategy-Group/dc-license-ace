import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPulseCadence, setPulseCadence } from "@/lib/modules.functions";
import { BoostAgent } from "@/components/boost/BoostAgent";
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
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Boost!Pulse</h1>
        <p className="text-muted-foreground">Employee engagement surveys.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4"><Activity className="h-4 w-4" /><h2 className="font-semibold">Cadence</h2></div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm">Current:</span>
              <Badge>{cad.data?.cadence ?? "—"}</Badge>
              <Badge variant={cad.data?.active ? "default" : "outline"}>{cad.data?.active ? "Active" : "Inactive"}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {CADENCES.map((c) => (
                <Button
                  key={c} size="sm"
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
