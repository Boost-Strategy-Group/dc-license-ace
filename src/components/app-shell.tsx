import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useIsSuperAdmin } from "@/hooks/use-tenants";
import { Button } from "@/components/ui/button";
import { Activity, BookOpen, Briefcase, Building2, ClipboardList, GraduationCap, LayoutDashboard, Library, LogOut, Plug, Repeat2, Rocket, Send, ShieldCheck, Sparkles, Target, Timer, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin, canManageStudents, signOut, user } = useAuth();
  const { data: superAdminCheck } = useIsSuperAdmin();
  const isSuper = !!superAdminCheck?.isSuperAdmin;
  const loc = useLocation();
  const learnNav = [
    { to: "/launchpad", label: "Launchpad", icon: Rocket },
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/catalog", label: "Catalog", icon: Library },
    { to: "/vault", label: "Student vault", icon: Wallet },
  ];
  const boostNav = [
    { to: "/modules/roles", label: "Boost!Roles", icon: Briefcase },
    { to: "/modules/perform", label: "Boost!Perform", icon: Target },
    { to: "/modules/pulse", label: "Boost!Pulse", icon: Activity },
    { to: "/modules/learn", label: "Boost!Learn", icon: BookOpen },
    { to: "/employees", label: "Employees", icon: Users },
  ];
  const studyNav = [
    { to: "/practice", label: "Practice", icon: BookOpen },
    { to: "/mock", label: "Mock exam", icon: Timer },
    { to: "/review", label: "Review queue", icon: Repeat2 },
    { to: "/state/screening", label: "State training", icon: ShieldCheck },
    { to: "/apprenticeship/rti", label: "My RTI hours", icon: GraduationCap },
  ];
  const adminNav = [
    { to: "/admin/students", label: "Students", icon: Users },
    { to: "/admin/questions", label: "Question bank", icon: ClipboardList },
    { to: "/admin/state", label: "State training", icon: ShieldCheck },
    { to: "/admin/apprenticeship", label: "Apprenticeship & RTI", icon: GraduationCap },
    { to: "/admin/analytics", label: "Analytics", icon: GraduationCap },
  ];
  const tenantAdminNav = [
    { to: "/admin/student-management", label: "Student management", icon: Users },
  ];
  const platformNav = [
    { to: "/admin/tenants", label: "Tenants", icon: Building2 },
    { to: "/admin/courses", label: "Courses", icon: BookOpen },
    { to: "/admin/publications", label: "Publications", icon: Send },
    { to: "/admin/ai-factory", label: "AI Course Factory", icon: Sparkles },
    { to: "/admin/integrations", label: "Integrations", icon: Plug },
  ];
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-background/95 p-1">
            <img src="/boost-logo.png" alt="Boost Strategy Group" className="h-full w-full object-contain" width={36} height={36} />
          </div>
          <div>
            <div className="font-display text-base font-semibold">Boost Readiness</div>
            <div className="text-[11px] text-sidebar-foreground/60">DC LCSW Apprenticeship</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          <SectionLabel>Learn</SectionLabel>
          {learnNav.map((n) => (
            <NavLink key={n.to} to={n.to} icon={n.icon} active={loc.pathname === n.to || (n.to !== "/dashboard" && loc.pathname.startsWith(n.to))}>
              {n.label}
            </NavLink>
          ))}
          <SectionLabel>BOOST! Modules</SectionLabel>
          {boostNav.map((n) => (
            <NavLink key={n.to} to={n.to} icon={n.icon} active={loc.pathname.startsWith(n.to)}>
              {n.label}
            </NavLink>
          ))}
          <SectionLabel>LCSW Study</SectionLabel>
          {studyNav.map((n) => (
            <NavLink key={n.to} to={n.to} icon={n.icon} active={loc.pathname.startsWith(n.to)}>
              {n.label}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              <SectionLabel>LCSW Admin</SectionLabel>
              {adminNav.map((n) => (
                <NavLink key={n.to} to={n.to} icon={n.icon} active={loc.pathname.startsWith(n.to)}>
                  {n.label}
                </NavLink>
              ))}
            </>
          )}
          {isSuper && (
            <>
              <SectionLabel>Platform</SectionLabel>
              {platformNav.map((n) => (
                <NavLink key={n.to} to={n.to} icon={n.icon} active={loc.pathname.startsWith(n.to)}>
                  {n.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="px-2 pb-2 text-xs text-sidebar-foreground/70 truncate">{user?.email}</div>
          <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="border-b border-border bg-card px-4 py-3 md:hidden flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/boost-logo.png" alt="Boost Strategy Group" className="h-7 w-7 object-contain" width={28} height={28} />
            <span className="font-display font-semibold">Boost</span>
          </Link>
          <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
        <div className="md:hidden flex gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2">
          {[...learnNav, ...boostNav, ...studyNav, ...(isAdmin ? adminNav : []), ...(isSuper ? platformNav : [])].map((n) => {
            const Icon = n.icon;
            const active = loc.pathname === n.to || (n.to !== "/dashboard" && loc.pathname.startsWith(n.to));
            return (
              <Link key={n.to} to={n.to} className={cn("flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs", active ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                <Icon className="h-3.5 w-3.5" /> {n.label}
              </Link>
            );
          })}
        </div>
        <div className="p-6 md:p-10">{children}</div>
      </main>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mt-4 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">{children}</div>;
}
function NavLink({ to, icon: Icon, active, children }: { to: string; icon: typeof LogOut; active: boolean; children: ReactNode }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60")}>
      <Icon className="h-4 w-4" /> {children}
    </Link>
  );
}
