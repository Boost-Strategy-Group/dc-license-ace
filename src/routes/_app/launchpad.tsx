import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLaunchpad } from "@/lib/launchpad.functions";
import { ModuleTile } from "@/components/boost/ModuleTile";
import { InitialsAvatar } from "@/components/boost/InitialsAvatar";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/launchpad")({
  head: () => ({
    meta: [
      { title: "Launchpad · BoostMyWorkforce" },
      { name: "description", content: "Your workforce hub — training, performance, engagement, and roles, all in one place." },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-sm">Not found</div>,
  component: Launchpad,
});

function launchpadQuery(fn: () => Promise<Awaited<ReturnType<typeof getLaunchpad>>>) {
  return queryOptions({ queryKey: ["launchpad"], queryFn: fn });
}

function Launchpad() {
  const { user } = useAuth();
  const fn = useServerFn(getLaunchpad);
  const { data } = useSuspenseQuery(launchpadQuery(() => fn()));

  const first =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "there";

  return (
    <div className="mx-auto max-w-6xl space-y-10 py-8 px-4">
      <header className="flex items-center gap-4">
        {data.tenant && <InitialsAvatar name={data.tenant.name} src={data.tenant.logoUrl} size={56} />}
        <div>
          <p className="text-sm text-muted-foreground">Welcome back, {first}</p>
          <h1 className="font-display text-3xl font-semibold">
            {data.tenant?.name ?? "BoostMyWorkforce"}
          </h1>
        </div>
      </header>

      <section>
        <h2 className="sr-only">Your modules</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {data.tiles.map((t) => (
            <ModuleTile
              key={t.key}
              name={t.name}
              tagline={t.tagline}
              iconKey={t.key}
              status={t.status}
              href={t.href}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
