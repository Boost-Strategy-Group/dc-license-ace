import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Briefcase, Target, Activity, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in · BOOST Learning & Credentialing" }, { name: "description", content: "Sign in to the BOOST Learning & Credentialing Platform." }] }),
  component: AuthPage,
});

const HIGHLIGHTS = [
  { icon: Briefcase, label: "Boost!Roles", copy: "Job descriptions & org charts" },
  { icon: Target, label: "Boost!Perform", copy: "Goals & review cycles" },
  { icon: Activity, label: "Boost!Pulse", copy: "Engagement surveys" },
  { icon: GraduationCap, label: "Boost!Learn", copy: "Training & credentials" },
] as const;

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else navigate({ to: "/dashboard" });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You can sign in now.");
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (result.error) { setBusy(false); toast.error(String(result.error?.message ?? "Google sign-in failed")); return; }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="brand-gradient relative hidden flex-col justify-between overflow-hidden p-12 text-primary-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-primary-foreground/10 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-md bg-primary-foreground/95 p-1.5">
            <img src="/boost-logo.png" alt="Boost Strategy Group" className="h-full w-full object-contain" width={44} height={44} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold">BOOST</div>
            <div className="text-xs uppercase tracking-[0.2em] text-primary-foreground/70">Strategy Group</div>
          </div>
        </div>

        <div className="relative space-y-6">
          <h2 className="font-display text-3xl font-semibold leading-tight text-balance">
            Train, engage, and grow your workforce — in one place.
          </h2>
          <ul className="space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h.label} className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-lg bg-primary-foreground/10">
                  <h.icon className="size-4 text-accent" aria-hidden />
                </div>
                <div>
                  <div className="text-sm font-medium">{h.label}</div>
                  <div className="text-xs text-primary-foreground/70">{h.copy}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          BOOST Learning &amp; Credentialing Platform
        </p>
      </aside>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <img src="/boost-logo.png" alt="Boost Strategy Group" className="mx-auto mb-3 h-12 w-auto" width={48} height={48} />
            <h1 className="font-display text-2xl font-semibold">BOOST Learning</h1>
            <p className="text-sm text-muted-foreground">Sign in to your launchpad.</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">Welcome</CardTitle>
              <CardDescription>Use your Boost-issued email or Google account.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Create account</TabsTrigger>
                </TabsList>
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <Button type="submit" disabled={busy} className="w-full">Sign in</Button>
                  </form>
                </TabsContent>
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full name</Label>
                      <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email2">Email</Label>
                      <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password2">Password</Label>
                      <Input id="password2" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <Button type="submit" disabled={busy} className="w-full">Create account</Button>
                  </form>
                </TabsContent>
              </Tabs>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Button type="button" variant="outline" disabled={busy} onClick={handleGoogle} className="w-full">
                Continue with Google
              </Button>

              <div className="mt-6 rounded-md border border-dashed border-border bg-muted/40 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Test accounts (dev)
                </p>
                <div className="grid gap-2">
                  {[
                    { label: "Super Admin", email: "jackie@boost.test" },
                    { label: "Tenant Admin", email: "admin@boost.test" },
                    { label: "Learner", email: "learner@boost.test" },
                  ].map((u) => (
                    <Button
                      key={u.email}
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        const pw = "B00st-Launch!2026$";
                        setEmail(u.email);
                        setPassword(pw);
                        setBusy(true);
                        let { error } = await supabase.auth.signInWithPassword({ email: u.email, password: pw });
                        if (error) {
                          const { error: suErr } = await supabase.auth.signUp({
                            email: u.email,
                            password: pw,
                            options: { data: { full_name: u.label }, emailRedirectTo: `${window.location.origin}/dashboard` },
                          });
                          if (suErr) { setBusy(false); toast.error(suErr.message); return; }
                          ({ error } = await supabase.auth.signInWithPassword({ email: u.email, password: pw }));
                        }
                        setBusy(false);
                        if (error) toast.error(error.message);
                        else navigate({ to: "/dashboard" });
                      }}
                      className="w-full justify-between"
                    >
                      <span>{u.label}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Password for all: <code>B00st-Launch!2026$</code></p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
