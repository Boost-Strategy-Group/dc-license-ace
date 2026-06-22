
-- =========================================================================
-- BoostMyWorkforce v3 — schema migration (uses boost_modules to avoid
-- collision with existing course-lesson `modules` table)
-- =========================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS logo_asset_url text,
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS tenant_type text NOT NULL DEFAULT 'standard';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_custom_domain_key') THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_custom_domain_key UNIQUE (custom_domain);
  END IF;
END $$;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS rti_hours numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'boost_factory';
ALTER TABLE public.courses ALTER COLUMN tenant_id DROP NOT NULL;

-- boost_modules
CREATE TABLE IF NOT EXISTS public.boost_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.boost_modules TO authenticated, anon;
GRANT ALL ON public.boost_modules TO service_role;
ALTER TABLE public.boost_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boost_modules readable by all" ON public.boost_modules FOR SELECT USING (true);
CREATE POLICY "boost_modules managed by super admin" ON public.boost_modules
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER boost_modules_updated_at BEFORE UPDATE ON public.boost_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- tenant_boost_modules
CREATE TABLE IF NOT EXISTS public.tenant_boost_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  boost_module_id uuid NOT NULL REFERENCES public.boost_modules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, boost_module_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_boost_modules TO authenticated;
GRANT ALL ON public.tenant_boost_modules TO service_role;
ALTER TABLE public.tenant_boost_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tbm readable by members" ON public.tenant_boost_modules
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "tbm managed by super admin" ON public.tenant_boost_modules
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER tbm_updated_at BEFORE UPDATE ON public.tenant_boost_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- apprenticeship_programs
CREATE TABLE IF NOT EXISTS public.apprenticeship_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  required_rti_hours numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apprenticeship_programs TO authenticated;
GRANT ALL ON public.apprenticeship_programs TO service_role;
ALTER TABLE public.apprenticeship_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ap readable by tenant" ON public.apprenticeship_programs
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "ap managed by tenant admin" ON public.apprenticeship_programs
  FOR ALL TO authenticated
  USING (public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
CREATE TRIGGER ap_updated_at BEFORE UPDATE ON public.apprenticeship_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- learners
CREATE TABLE IF NOT EXISTS public.learners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_apprentice boolean NOT NULL DEFAULT false,
  apprenticeship_program_id uuid REFERENCES public.apprenticeship_programs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learners TO authenticated;
GRANT ALL ON public.learners TO service_role;
ALTER TABLE public.learners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learners self read" ON public.learners
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
CREATE POLICY "learners managed by tenant admin" ON public.learners
  FOR ALL TO authenticated
  USING (public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
CREATE TRIGGER learners_updated_at BEFORE UPDATE ON public.learners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- rti_completions
CREATE TABLE IF NOT EXISTS public.rti_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  rti_hours numeric NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rti_completions TO authenticated;
GRANT ALL ON public.rti_completions TO service_role;
ALTER TABLE public.rti_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rti readable by self or admin" ON public.rti_completions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learners l WHERE l.id = learner_id
    AND (l.user_id = auth.uid() OR public.has_tenant_role(l.tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))));
CREATE POLICY "rti writable by tenant admin" ON public.rti_completions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.learners l WHERE l.id = learner_id
    AND (public.has_tenant_role(l.tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.learners l WHERE l.id = learner_id
    AND (public.has_tenant_role(l.tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))));

-- course_publications
CREATE TABLE IF NOT EXISTS public.course_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid,
  source text NOT NULL DEFAULT 'boost_factory',
  status text NOT NULL DEFAULT 'published',
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_publications_target_idx ON public.course_publications(target_type, target_id);
CREATE INDEX IF NOT EXISTS course_publications_course_idx ON public.course_publications(course_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_publications TO authenticated;
GRANT ALL ON public.course_publications TO service_role;
ALTER TABLE public.course_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publications readable by target" ON public.course_publications
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid())
    OR (target_type = 'tenant' AND target_id IS NOT NULL AND public.is_tenant_member(target_id, auth.uid()))
    OR (target_type = 'apprenticeship_program' AND EXISTS (SELECT 1 FROM public.apprenticeship_programs ap
          WHERE ap.id = target_id AND public.is_tenant_member(ap.tenant_id, auth.uid()))));
CREATE POLICY "publications managed by super admin" ON public.course_publications
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER course_publications_updated_at BEFORE UPDATE ON public.course_publications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- state_authorizations
CREATE TABLE IF NOT EXISTS public.state_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  state_code text NOT NULL,
  occupation text NOT NULL,
  etpl_status text,
  funding_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.state_authorizations TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.state_authorizations TO authenticated;
GRANT ALL ON public.state_authorizations TO service_role;
ALTER TABLE public.state_authorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "state_auth public read" ON public.state_authorizations FOR SELECT USING (true);
CREATE POLICY "state_auth managed by super admin" ON public.state_authorizations
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER state_auth_updated_at BEFORE UPDATE ON public.state_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- employees
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  job_title text,
  department text,
  hire_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees readable by tenant" ON public.employees
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "employees managed by tenant admin" ON public.employees
  FOR ALL TO authenticated
  USING (public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
CREATE TRIGGER employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- state_vouchers
CREATE TABLE IF NOT EXISTS public.state_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'issued',
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.state_vouchers TO authenticated;
GRANT ALL ON public.state_vouchers TO service_role;
ALTER TABLE public.state_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vouchers readable" ON public.state_vouchers
  FOR SELECT TO authenticated
  USING (redeemed_by = auth.uid() OR public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
CREATE POLICY "vouchers managed by tenant admin" ON public.state_vouchers
  FOR ALL TO authenticated
  USING (public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_tenant_role(tenant_id, auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
CREATE TRIGGER state_vouchers_updated_at BEFORE UPDATE ON public.state_vouchers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- eligibility_screenings
CREATE TABLE IF NOT EXISTS public.eligibility_screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  unemployed boolean NOT NULL DEFAULT false,
  underemployed boolean NOT NULL DEFAULT false,
  public_assistance boolean NOT NULL DEFAULT false,
  qualified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eligibility_screenings TO authenticated;
GRANT ALL ON public.eligibility_screenings TO service_role;
ALTER TABLE public.eligibility_screenings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "elig self r/w" ON public.eligibility_screenings
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- state_appointments
CREATE TABLE IF NOT EXISTS public.state_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eligibility_id uuid NOT NULL REFERENCES public.eligibility_screenings(id) ON DELETE CASCADE,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.state_appointments TO authenticated;
GRANT ALL ON public.state_appointments TO service_role;
ALTER TABLE public.state_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appt readable" ON public.state_appointments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.eligibility_screenings e WHERE e.id = eligibility_id
    AND (e.user_id = auth.uid() OR public.is_super_admin(auth.uid()))));
CREATE POLICY "appt writable" ON public.state_appointments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.eligibility_screenings e WHERE e.id = eligibility_id
    AND (e.user_id = auth.uid() OR public.is_super_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.eligibility_screenings e WHERE e.id = eligibility_id
    AND (e.user_id = auth.uid() OR public.is_super_admin(auth.uid()))));
CREATE TRIGGER state_appt_updated_at BEFORE UPDATE ON public.state_appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seeds
INSERT INTO public.boost_modules (key, name, tagline, description) VALUES
  ('roles',   'Boost!Roles',   'Job descriptions & org charts',  'Define roles, build org charts, keep job descriptions current.'),
  ('perform', 'Boost!Perform', 'Performance management',         'Goals, reviews, and continuous feedback for small teams.'),
  ('pulse',   'Boost!Pulse',   'Employee engagement surveys',    'Run pulse surveys on the cadence you choose.'),
  ('learn',   'Boost!Learn',   'Training, certifications, RTI',  'Assigned training, certificates, and apprenticeship RTI tracking.')
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name, tagline = EXCLUDED.tagline, description = EXCLUDED.description;

INSERT INTO public.tenant_boost_modules (tenant_id, boost_module_id, status)
SELECT t.id, m.id, CASE WHEN m.key = 'learn' THEN 'active' ELSE 'coming_soon' END
FROM public.tenants t CROSS JOIN public.boost_modules m
ON CONFLICT (tenant_id, boost_module_id) DO NOTHING;

INSERT INTO public.course_publications (course_id, target_type, target_id, source, status)
SELECT c.id, 'tenant', c.tenant_id, COALESCE(c.source, 'boost_factory'), 'published'
FROM public.courses c WHERE c.tenant_id IS NOT NULL;
