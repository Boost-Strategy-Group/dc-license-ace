
CREATE TABLE public.gosprout_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  gosprout_username text,
  gosprout_program_url text,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','inactive')),
  last_launched_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gosprout_links TO authenticated;
GRANT ALL ON public.gosprout_links TO service_role;

ALTER TABLE public.gosprout_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner reads own gosprout link"
  ON public.gosprout_links FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE POLICY "learner updates own launch ts"
  ON public.gosprout_links FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE POLICY "tenant admin inserts gosprout link"
  ON public.gosprout_links FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE POLICY "tenant admin deletes gosprout link"
  ON public.gosprout_links FOR DELETE TO authenticated
  USING (public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE TRIGGER gosprout_links_updated_at
  BEFORE UPDATE ON public.gosprout_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
