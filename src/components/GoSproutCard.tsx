import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyGoSprout, recordGoSproutLaunch } from "@/lib/gosprout.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Sprout } from "lucide-react";

export function GoSproutCard() {
  const getFn = useServerFn(getMyGoSprout);
  const launchFn = useServerFn(recordGoSproutLaunch);
  const { data, isLoading } = useQuery({ queryKey: ["my-gosprout"], queryFn: () => getFn() });
  const launch = useMutation({
    mutationFn: (linkId: string) => launchFn({ data: { linkId } }),
  });

  if (isLoading || !data) return null;

  const handleLaunch = () => {
    launch.mutate(data.link_id);
    window.open(data.launch_url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Sprout className="h-5 w-5 text-emerald-600" />
          <CardTitle className="text-sm font-medium">Apprenticeship hours · GoSprout</CardTitle>
        </div>
        <Badge variant="outline" className="capitalize">{data.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Log your on-the-job hours and related-instruction progress in GoSprout, your sponsor's
          apprenticeship system.
        </p>
        {data.username && (
          <p className="text-xs text-muted-foreground">
            Sign in as <span className="font-mono">{data.username}</span>
          </p>
        )}
        {data.instructions_md && (
          <p className="whitespace-pre-line rounded-md bg-muted/50 p-3 text-xs">{data.instructions_md}</p>
        )}
        <Button onClick={handleLaunch} className="w-full gap-2">
          Open GoSprout <ExternalLink className="h-4 w-4" />
        </Button>
        {data.last_launched_at && (
          <p className="text-xs text-muted-foreground">
            Last opened {new Date(data.last_launched_at).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
