import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/boost/ModuleStub";

export const Route = createFileRoute("/_app/modules/pulse")({
  head: () => ({ meta: [{ title: "Boost!Pulse · BoostMyWorkforce" }] }),
  component: () => (
    <ModuleStub
      name="Boost!Pulse"
      tagline="Employee engagement surveys"
      whatYouCanDoNext={[
        "Pick a cadence (weekly, biweekly, monthly, quarterly)",
        "Choose participants by department, manager, or custom list",
        "Use the question bank or write your own",
        "See themed results and open-response sentiment",
      ]}
    />
  ),
});
