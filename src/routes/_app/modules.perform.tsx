import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/boost/ModuleStub";

export const Route = createFileRoute("/_app/modules/perform")({
  head: () => ({ meta: [{ title: "Boost!Perform · BoostMyWorkforce" }] }),
  component: () => (
    <ModuleStub
      name="Boost!Perform"
      tagline="Performance management"
      whatYouCanDoNext={[
        "Configure goal categories and weights",
        "Launch a review cycle in minutes",
        "Assign reviewers (manager, peer, self, 360)",
        "Calibrate results across the team",
      ]}
    />
  ),
});
