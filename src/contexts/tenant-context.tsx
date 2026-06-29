/**
 * TenantContext
 * Provides the resolved tenant + caller's role within that tenant
 * to every component inside a $slug route subtree.
 *
 * Populated by the $slug layout route loader — never fetch from here directly.
 */
import { createContext, useContext } from "react";

export type TenantRole =
  | "super_admin"
  | "bsg_admin"
  | "tenant_admin"
  | "manager"
  | "learner"
  | "instructor"
  | "mentor";

export type TenantCtxValue = {
  /** Tenant DB row */
  tenant: {
    id: string;
    slug: string;
    name: string;
    kind: string;
    logo_url: string | null;
    brand_primary: string | null;
    brand_secondary: string | null;
    welcome_copy: string | null;
    powered_by_boost_footer: boolean;
    custom_domain: string | null;
    modules_enabled: string[];
  };
  /** Caller's highest role within this tenant */
  callerRole: TenantRole;
  /** Convenience booleans */
  isSuperAdmin: boolean;
  isBsgAdmin: boolean;
  isTenantAdmin: boolean;
  isManager: boolean;
  isLearner: boolean;
  /** Can this role see the admin/config panel for this tenant? */
  canAdminTenant: boolean;
};

const TenantCtx = createContext<TenantCtxValue | null>(null);

export const TenantProvider = TenantCtx.Provider;

export function useTenant(): TenantCtxValue {
  const ctx = useContext(TenantCtx);
  if (!ctx) {
    throw new Error("useTenant() must be used inside a <TenantProvider> (a $slug route)");
  }
  return ctx;
}
