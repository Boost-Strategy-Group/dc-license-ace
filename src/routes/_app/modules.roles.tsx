import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/boost/ModuleStub";

export const Route = createFileRoute("/_app/modules/roles")({
  head: () => ({ meta: [{ title: "Boost!Roles · BoostMyWorkforce" }] }),
  component: () => (
    <ModuleStub
      name="Boost!Roles"
      tagline="Job descriptions & org charts"
      whatYouCanDoNext={[
        "Import your employee roster",
        "Build your org chart",
        "Generate AI-assisted job descriptions",
        "Publish a role library across your team",
      ]}
    />
  ),
});
