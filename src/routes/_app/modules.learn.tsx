import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/modules/learn")({
  head: () => ({ meta: [{ title: "Boost!Learn · BoostMyWorkforce" }] }),
  component: LearnModule,
});

function LearnModule() {
  return (
    <div className="mx-auto max-w-4xl py-12 px-4 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Boost!Learn</h1>
        <p className="text-muted-foreground">Training, certifications, and apprenticeship RTI.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">Catalog</h2>
          <p className="text-sm text-muted-foreground">Courses published to your organization.</p>
          <Button asChild><Link to="/catalog">Open catalog</Link></Button>
        </Card>
        <Card className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">My training</h2>
          <p className="text-sm text-muted-foreground">In-progress courses and certificates.</p>
          <Button asChild variant="outline"><Link to="/dashboard">Open dashboard</Link></Button>
        </Card>
      </div>
    </div>
  );
}
