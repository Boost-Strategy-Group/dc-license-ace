import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Target, Activity, GraduationCap, ArrowRight, Lock } from "lucide-react";

const ICONS = {
  roles: Briefcase,
  perform: Target,
  pulse: Activity,
  learn: GraduationCap,
} as const;

export type ModuleTileProps = {
  name: string;
  tagline: string;
  iconKey: keyof typeof ICONS;
  status: "active" | "coming_soon" | "available";
  href?: string;
  onAdd?: () => void;
};

export function ModuleTile({ name, tagline, iconKey, status, href, onAdd }: ModuleTileProps) {
  const Icon = ICONS[iconKey];
  const isActive = status === "active";

  return (
    <Card className="p-6 flex flex-col gap-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="rounded-md bg-muted p-3">
          <Icon className="size-6 text-foreground" aria-hidden />
        </div>
        {status === "coming_soon" && <Badge variant="secondary">Coming soon</Badge>}
        {status === "available" && <Badge variant="outline">Available</Badge>}
      </div>

      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="text-sm text-muted-foreground">{tagline}</p>
      </div>

      <div className="mt-auto pt-2">
        {isActive && href && (
          <Button asChild className="w-full">
            <Link to={href}>
              Open <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        )}
        {status === "coming_soon" && (
          <Button variant="ghost" disabled className="w-full">
            <Lock className="mr-2 size-4" /> Not yet enabled
          </Button>
        )}
        {status === "available" && (
          <Button variant="outline" className="w-full" onClick={onAdd}>
            Add this module
          </Button>
        )}
      </div>
    </Card>
  );
}
