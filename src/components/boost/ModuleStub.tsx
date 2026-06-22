import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export type ModuleStubProps = {
  name: string;
  tagline: string;
  whatYouCanDoNext: string[];
};

export function ModuleStub({ name, tagline, whatYouCanDoNext }: ModuleStubProps) {
  return (
    <div className="mx-auto max-w-2xl py-16 px-4 space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold">{name}</h1>
        <p className="text-muted-foreground">{tagline}</p>
      </header>

      <Card className="p-6 space-y-4">
        <p className="text-sm font-medium">This module is on the way. Here's what's coming:</p>
        <ul className="space-y-2">
          {whatYouCanDoNext.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
