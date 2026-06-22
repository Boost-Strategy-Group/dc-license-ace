import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ModulePageHeaderProps = {
  /** lucide-react icon component, e.g. Briefcase */
  icon: LucideIcon;
  /** Module wordmark, e.g. "Boost!Roles" */
  name: string;
  tagline: string;
  /** Optional right-aligned actions (buttons, etc.) */
  actions?: ReactNode;
};

/**
 * Shared header for the in-app module screens (Roles / Perform / Pulse / Learn).
 * Visual-only: brand-accent icon chip + display-font title. Uses theme tokens only.
 */
export function ModulePageHeader({ icon: Icon, name, tagline, actions }: ModulePageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent/15 ring-1 ring-accent/30">
          <Icon className="size-6 text-accent-foreground" aria-hidden />
        </div>
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold leading-tight text-balance">{name}</h1>
          <p className="text-sm text-muted-foreground text-pretty">{tagline}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
