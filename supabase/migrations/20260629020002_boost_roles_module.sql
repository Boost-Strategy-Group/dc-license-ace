-- =============================================================================
-- BOOST! My WorkForce Suite — Migration 2b: Boost!Roles Module
-- Tables: naics_codes, pay_bands, job_descriptions (extend), career_ladders,
--         job_history, promotion_readiness, perform_competency_templates
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. NAICS CODES (reference table — public read)
-- Pre-seeded with priority sectors for ≤100 employee employers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.naics_codes (
  code        text PRIMARY KEY,
  sector      text NOT NULL,
  description text NOT NULL
);

GRANT SELECT ON public.naics_codes TO anon, authenticated;
GRANT ALL ON public.naics_codes TO service_role;

ALTER TABLE public.naics_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "naics_public_read" ON public.naics_codes FOR SELECT USING (true);

-- Seed priority NAICS sectors
INSERT INTO public.naics_codes (code, sector, description) VALUES
  ('621111', 'Health Care', 'Offices of Physicians (except Mental Health Specialists)'),
  ('621112', 'Health Care', 'Offices of Physicians, Mental Health Specialists'),
  ('621330', 'Health Care', 'Offices of Mental Health Practitioners (except Physicians)'),
  ('621610', 'Health Care', 'Home Health Care Services'),
  ('623110', 'Health Care', 'Nursing Care Facilities (Skilled Nursing Facilities)'),
  ('623210', 'Health Care', 'Residential Intellectual and Developmental Disability Facilities'),
  ('623220', 'Health Care', 'Residential Mental Health and Substance Abuse Facilities'),
  ('624110', 'Social Assistance', 'Child and Youth Services'),
  ('624120', 'Social Assistance', 'Services for the Elderly and Persons with Disabilities'),
  ('624190', 'Social Assistance', 'Other Individual and Family Services'),
  ('624210', 'Social Assistance', 'Community Food Services'),
  ('624310', 'Social Assistance', 'Vocational Rehabilitation Services'),
  ('541110', 'Professional Services', 'Offices of Lawyers'),
  ('541211', 'Professional Services', 'Offices of Certified Public Accountants'),
  ('541310', 'Professional Services', 'Architectural Services'),
  ('541330', 'Professional Services', 'Engineering Services'),
  ('541511', 'Professional Services', 'Custom Computer Programming Services'),
  ('541512', 'Professional Services', 'Computer Systems Design Services'),
  ('541611', 'Professional Services', 'Administrative Management and General Management Consulting'),
  ('541612', 'Professional Services', 'Human Resources Consulting Services'),
  ('541613', 'Professional Services', 'Marketing Consulting Services'),
  ('541618', 'Professional Services', 'Other Management Consulting Services'),
  ('541810', 'Professional Services', 'Advertising Agencies'),
  ('561110', 'Administrative Support', 'Office Administrative Services'),
  ('561320', 'Administrative Support', 'Temporary Help Services'),
  ('561499', 'Administrative Support', 'All Other Business Support Services'),
  ('561720', 'Administrative Support', 'Janitorial Services'),
  ('611110', 'Education', 'Elementary and Secondary Schools'),
  ('611310', 'Education', 'Colleges, Universities, and Professional Schools'),
  ('611430', 'Education', 'Professional and Management Development Training'),
  ('611519', 'Education', 'Other Technical and Trade Schools'),
  ('611620', 'Education', 'Sports and Recreation Instruction'),
  ('813110', 'Nonprofit/Religious', 'Religious Organizations'),
  ('813211', 'Nonprofit/Religious', 'Grantmaking Foundations'),
  ('813319', 'Nonprofit/Religious', 'Other Social Advocacy Organizations'),
  ('813410', 'Nonprofit/Religious', 'Civic and Social Organizations'),
  ('813910', 'Nonprofit/Religious', 'Business Associations'),
  ('811111', 'Construction/Trades', 'General Automotive Repair'),
  ('236115', 'Construction/Trades', 'New Single-Family Housing Construction'),
  ('238210', 'Construction/Trades', 'Electrical Contractors and Other Wiring Installation Contractors'),
  ('722511', 'Accommodation/Food', 'Full-Service Restaurants'),
  ('722513', 'Accommodation/Food', 'Limited-Service Restaurants'),
  ('721110', 'Accommodation/Food', 'Hotels (except Casino Hotels) and Motels'),
  ('441110', 'Retail Trade', 'New Car Dealers'),
  ('446110', 'Retail Trade', 'Pharmacies and Drug Retailers'),
  ('452210', 'Retail Trade', 'Department Stores')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. PAY BANDS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pay_bands (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  band_name   text        NOT NULL,
  min_salary  numeric(12,2),
  max_salary  numeric(12,2),
  currency    text        NOT NULL DEFAULT 'USD',
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pay_bands_tenant_idx ON public.pay_bands (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pay_bands TO authenticated;
GRANT ALL ON public.pay_bands TO service_role;

ALTER TABLE public.pay_bands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pay_bands_read" ON public.pay_bands FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
         OR public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "pay_bands_write" ON public.pay_bands FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
              OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));

CREATE TRIGGER pay_bands_set_updated_at BEFORE UPDATE ON public.pay_bands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. EXTEND JOB_DESCRIPTIONS (table already exists from prior migration)
-- Add BOOST!-specific columns: pay_band_id, version, is_active, competencies
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_descriptions
  ADD COLUMN IF NOT EXISTS pay_band_id      uuid REFERENCES public.pay_bands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version          integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS competencies     jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS qualifications   jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_generated     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_check jsonb;

-- ---------------------------------------------------------------------------
-- 4. COMPETENCY TEMPLATES (reusable across tenants by tenant_admin)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perform_competency_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  behaviors   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS competency_templates_tenant_idx ON public.perform_competency_templates (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perform_competency_templates TO authenticated;
GRANT ALL ON public.perform_competency_templates TO service_role;

ALTER TABLE public.perform_competency_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competency_templates_read" ON public.perform_competency_templates FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
         OR public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "competency_templates_write" ON public.perform_competency_templates FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
              OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));

CREATE TRIGGER competency_templates_set_updated_at BEFORE UPDATE ON public.perform_competency_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. CAREER LADDERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.career_ladders (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  base_jd_id          uuid        NOT NULL REFERENCES public.job_descriptions(id) ON DELETE CASCADE,
  level_above_1_jd_id uuid        REFERENCES public.job_descriptions(id) ON DELETE SET NULL,
  level_above_2_jd_id uuid        REFERENCES public.job_descriptions(id) ON DELETE SET NULL,
  suggested_by_ai     boolean     NOT NULL DEFAULT false,
  created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, base_jd_id)
);
CREATE INDEX IF NOT EXISTS career_ladders_tenant_idx ON public.career_ladders (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_ladders TO authenticated;
GRANT ALL ON public.career_ladders TO service_role;

ALTER TABLE public.career_ladders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_ladders_read" ON public.career_ladders FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
         OR public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "career_ladders_write" ON public.career_ladders FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
              OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));

CREATE TRIGGER career_ladders_set_updated_at BEFORE UPDATE ON public.career_ladders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. JOB HISTORY (employee career history log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  learner_id    uuid        NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  job_title     text        NOT NULL,
  department    text,
  start_date    date        NOT NULL,
  end_date      date,
  pay_band_id   uuid        REFERENCES public.pay_bands(id) ON DELETE SET NULL,
  salary        numeric(12,2),
  change_type   text        NOT NULL DEFAULT 'hire'
                            CHECK (change_type IN ('hire','promotion','lateral','separation','adjustment')),
  notes         text,
  recorded_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_history_learner_idx ON public.job_history (learner_id, start_date DESC);
CREATE INDEX IF NOT EXISTS job_history_tenant_idx ON public.job_history (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_history TO authenticated;
GRANT ALL ON public.job_history TO service_role;

ALTER TABLE public.job_history ENABLE ROW LEVEL SECURITY;

-- Employees can see their own history; managers see team; admin sees all
CREATE POLICY "job_history_read" ON public.job_history FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR public.has_tenant_role(tenant_id, auth.uid(), 'manager')
    OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = learner_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "job_history_write" ON public.job_history FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
  );

-- ---------------------------------------------------------------------------
-- 7. PROMOTION READINESS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promotion_readiness (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  learner_id      uuid        NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  readiness_level text        NOT NULL DEFAULT 'not_ready'
                              CHECK (readiness_level IN ('ready_now','ready_6mo','ready_12mo','not_ready')),
  target_jd_id    uuid        REFERENCES public.job_descriptions(id) ON DELETE SET NULL,
  notes           text,
  assessed_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  assessed_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, learner_id)
);
CREATE INDEX IF NOT EXISTS promotion_readiness_tenant_idx ON public.promotion_readiness (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_readiness TO authenticated;
GRANT ALL ON public.promotion_readiness TO service_role;

ALTER TABLE public.promotion_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotion_readiness_read" ON public.promotion_readiness FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR public.has_tenant_role(tenant_id, auth.uid(), 'manager')
  );

CREATE POLICY "promotion_readiness_write" ON public.promotion_readiness FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR public.has_tenant_role(tenant_id, auth.uid(), 'manager')
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR public.has_tenant_role(tenant_id, auth.uid(), 'manager')
  );

CREATE TRIGGER promotion_readiness_set_updated_at BEFORE UPDATE ON public.promotion_readiness
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
