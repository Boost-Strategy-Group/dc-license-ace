import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  submitEligibilityScreening,
  listMyScreenings,
  redeemVoucher,
} from "@/lib/state.functions";
import { listTenants } from "@/lib/tenants.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, Ticket } from "lucide-react";

export const Route = createFileRoute("/_app/state/screening")({
  head: () => ({ meta: [{ title: "Eligibility screening · BoostMyWorkforce" }] }),
  component: ScreeningPage,
});

function ScreeningPage() {
  const tenantsFn = useServerFn(listTenants);
  const submitFn = useServerFn(submitEligibilityScreening);
  const minesFn = useServerFn(listMyScreenings);
  const redeemFn = useServerFn(redeemVoucher);
  const qc = useQueryClient();

  const { data: tenants } = useQuery({ queryKey: ["tenants"], queryFn: () => tenantsFn() });
  const { data: mine } = useQuery({ queryKey: ["my-screenings"], queryFn: () => minesFn() });

  const [tenantId, setTenantId] = useState("");
  const [unemployed, setUnemployed] = useState(false);
  const [underemployed, setUnderemployed] = useState(false);
  const [publicAssistance, setPublicAssistance] = useState(false);
  const [voucher, setVoucher] = useState("");

  const submitMut = useMutation({
    mutationFn: () =>
      submitFn({
        data: { tenantId, unemployed, underemployed, publicAssistance },
      }),
    onSuccess: (row: any) => {
      toast.success(row.qualified ? "You qualify for state-funded training." : "Submitted — not currently eligible.");
      qc.invalidateQueries({ queryKey: ["my-screenings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const redeemMut = useMutation({
    mutationFn: () => redeemFn({ data: { code: voucher } }),
    onSuccess: () => {
      toast.success("Voucher redeemed");
      setVoucher("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-10 px-4">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">State training eligibility</h1>
        <p className="text-muted-foreground">
          Answer a few questions to see if you qualify for state-funded training, then redeem
          your voucher or pay the copay.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">Screening</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Sponsoring organization</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger><SelectValue placeholder="Choose organization" /></SelectTrigger>
              <SelectContent>
                {(tenants ?? []).map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Row checked={unemployed} onChange={setUnemployed} label="I am currently unemployed" />
            <Row checked={underemployed} onChange={setUnderemployed} label="I am underemployed" />
            <Row checked={publicAssistance} onChange={setPublicAssistance} label="I receive public assistance" />
          </div>
          <Button
            className="gap-2"
            disabled={!tenantId || submitMut.isPending}
            onClick={() => submitMut.mutate()}
          >
            <ShieldCheck className="h-4 w-4" /> Submit screening
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Redeem a voucher</CardTitle></CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="flex-1">
            <Label className="mb-1 block text-xs text-muted-foreground">Voucher code</Label>
            <Input value={voucher} onChange={(e) => setVoucher(e.target.value)} placeholder="STATE-1234" />
          </div>
          <Button
            variant="outline"
            className="gap-2"
            disabled={!voucher || redeemMut.isPending}
            onClick={() => redeemMut.mutate()}
          >
            <Ticket className="h-4 w-4" /> Redeem
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Your screenings</CardTitle></CardHeader>
        <CardContent>
          {!mine?.length && (
            <p className="text-sm text-muted-foreground">No screenings yet.</p>
          )}
          <ul className="divide-y">
            {(mine ?? []).map((s: any) => (
              <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                <Badge variant={s.qualified ? "default" : "outline"}>
                  {s.qualified ? "Qualified" : "Not eligible"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span>{label}</span>
    </label>
  );
}
