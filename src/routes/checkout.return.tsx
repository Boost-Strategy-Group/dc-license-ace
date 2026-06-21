import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/checkout/return")({
  head: () => ({ meta: [{ title: "Payment complete · Boost" }] }),
  validateSearch: (s: Record<string, unknown>): { session_id?: string; course?: string } => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
    course: typeof s.course === "string" ? s.course : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id, course } = Route.useSearch();
  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            Payment received
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {session_id
              ? "Your enrollment is being activated. You can start learning right away — completion will sync once payment finalizes (usually within seconds)."
              : "We couldn't read your session details, but your payment may still have gone through. Check your enrollments."}
          </p>
          <div className="flex gap-2">
            {course ? (
              <Link to="/learn/$courseId" params={{ courseId: course }}>
                <Button>Start course</Button>
              </Link>
            ) : (
              <Link to="/dashboard"><Button>Go to dashboard</Button></Link>
            )}
            <Link to="/catalog"><Button variant="outline">Back to catalog</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
