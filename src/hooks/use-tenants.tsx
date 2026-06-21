import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyMemberships, checkSuperAdmin, type TenantRow } from "@/lib/tenants.functions";
import { useAuth } from "./use-auth";

export type Membership = { role: string; tenant: TenantRow };

export function useMyMemberships() {
  const { user } = useAuth();
  const fn = useServerFn(listMyMemberships);
  return useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useIsSuperAdmin() {
  const { user } = useAuth();
  const fn = useServerFn(checkSuperAdmin);
  return useQuery({
    queryKey: ["is-super-admin", user?.id],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 60_000,
  });
}
