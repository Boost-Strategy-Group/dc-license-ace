
-- =========================================================
-- Phase 3 + 4 schema: module tables and BOOST! agent
-- =========================================================

-- ---------- Boost!Roles ----------
CREATE TABLE public.job_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  responsibilities text,
  qualifications text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_descriptions TO authenticated;
GRANT ALL ON public.job_descriptions TO service_role;
ALTER TABLE public.job_descriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant admins manage JDs" ON public.job_descriptions FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));
CREATE POLICY "tenant members view JDs" ON public.job_descriptions FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE TRIGGER trg_jd_updated BEFORE UPDATE ON public.job_descriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.org_chart_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.org_chart_nodes(id) ON DELETE CASCADE,
  title text NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_chart_nodes TO authenticated;
GRANT ALL ON public.org_chart_nodes TO service_role;
ALTER TABLE public.org_chart_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant admins manage org" ON public.org_chart_nodes FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));
CREATE POLICY "tenant members view org" ON public.org_chart_nodes FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE TRIGGER trg_org_updated BEFORE UPDATE ON public.org_chart_nodes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Boost!Perform ----------
CREATE TABLE public.perform_goal_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  weight numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perform_goal_categories TO authenticated;
GRANT ALL ON public.perform_goal_categories TO service_role;
ALTER TABLE public.perform_goal_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant admins manage categories" ON public.perform_goal_categories FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));
CREATE POLICY "tenant members view categories" ON public.perform_goal_categories FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE TRIGGER trg_pgc_updated BEFORE UPDATE ON public.perform_goal_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.perform_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.perform_goal_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perform_goals TO authenticated;
GRANT ALL ON public.perform_goals TO service_role;
ALTER TABLE public.perform_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant admins manage goals" ON public.perform_goals FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));
CREATE POLICY "owner views own goals" ON public.perform_goals FOR SELECT TO authenticated
USING (owner_user_id = auth.uid() OR public.is_tenant_member(tenant_id, auth.uid()));
CREATE TRIGGER trg_pg_updated BEFORE UPDATE ON public.perform_goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.perform_review_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  starts_at date,
  ends_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perform_review_cycles TO authenticated;
GRANT ALL ON public.perform_review_cycles TO service_role;
ALTER TABLE public.perform_review_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant admins manage cycles" ON public.perform_review_cycles FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));
CREATE POLICY "tenant members view cycles" ON public.perform_review_cycles FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE TRIGGER trg_prc_updated BEFORE UPDATE ON public.perform_review_cycles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Boost!Pulse ----------
CREATE TABLE public.pulse_cadences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cadence text NOT NULL DEFAULT 'monthly',
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pulse_cadences TO authenticated;
GRANT ALL ON public.pulse_cadences TO service_role;
ALTER TABLE public.pulse_cadences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant admins manage cadences" ON public.pulse_cadences FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));
CREATE POLICY "tenant members view cadences" ON public.pulse_cadences FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE TRIGGER trg_pc_updated BEFORE UPDATE ON public.pulse_cadences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Approvals (email-confirmed go-lives) ----------
CREATE TABLE public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL, -- 'perform_cycle_publish' | 'pulse_launch' | 'goal_program_publish'
  target_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'cancelled' | 'expired'
  email_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  confirmed_at timestamptz,
  confirmed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant admins view approvals" ON public.approval_requests FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin') OR requested_by = auth.uid());
CREATE POLICY "tenant admins create approvals" ON public.approval_requests FOR INSERT TO authenticated
WITH CHECK (requested_by = auth.uid() AND (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')));
CREATE POLICY "tenant admins update approvals" ON public.approval_requests FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));
CREATE TRIGGER trg_ar_updated BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- BOOST! agent conversations ----------
CREATE TABLE public.boost_agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key text NOT NULL, -- 'roles' | 'perform' | 'pulse'
  title text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boost_agent_conversations TO authenticated;
GRANT ALL ON public.boost_agent_conversations TO service_role;
ALTER TABLE public.boost_agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages own conversations" ON public.boost_agent_conversations FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_bac_updated BEFORE UPDATE ON public.boost_agent_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
