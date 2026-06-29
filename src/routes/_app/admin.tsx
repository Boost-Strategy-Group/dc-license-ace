import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  // isAdmin = super_admin OR bsg_admin (both cross-tenant platform roles)
  const { isAdmin, isSuperAdmin, isBsgAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, navigate]);
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!isAdmin) return null;
  return <Outlet />;
}
