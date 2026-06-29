-- =============================================================================
-- BOOST! My WorkForce Suite — Migration 2a: Core Expansion
-- Adds: bsg_admin + manager roles, tenants expansion, audit_trail,
--       BOOST! client tenant seeds, handle_new_user extension
-- Rules: CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, ADD VALUE IF NOT EXISTS
--        Every table: CREATE → GRANT → ENABLE RLS → POLICY
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ROLE ENUM EXPANSION
-- ---------------------------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'bsg_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- ---------------------------------------------------------------------------
-- 2. EXTEND TENANTS TABLE
-- Existing cols: id, slug, name, kind, logo_url, brand_primary, brand_secondary,
--                welcome_copy, custom_domain, powered_by_boost_footer, settings,
--                created_at, updated_at
-- Adding BOOST! workforce management cols
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS naics_code         text,
  ADD COLUMN IF NOT EXISTS naics_description  text,
  ADD COLUMN IF NOT EXISTS website            text,
  ADD COLUMN IF NOT EXISTS billing_email      text,
  ADD COLUMN IF NOT EXISTS subscription_tier  text NOT NULL DEFAULT 'starter'
                                              CHECK (subscription_tier IN ('starter','growth','suite','enterprise','founding')),
  ADD COLUMN IF NOT EXISTS modules_enabled    jsonb NOT NULL DEFAULT '["learn"]'::jsonb,
  ADD COLUMN IF NOT EXISTS culture_doc_url    text,
  ADD COLUMN IF NOT EXISTS onboarding_call_transcript_url text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS employee_count_range text
                                              CHECK (employee_count_range IN ('1-25','26-50','51-75','76-100')),
  ADD COLUMN IF NOT EXISTS org_type           text
                                              CHECK (org_type IN ('for_profit','nonprofit','government'));

-- ---------------------------------------------------------------------------
-- 3. BOOST! HELPER: is_bsg_admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_bsg_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'bsg_admin'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_bsg_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_bsg_admin(uuid) TO authenticated, service_role;

-- BOOST! helper: has_any_tenant_role (manager OR tenant_admin OR bsg_admin)
CREATE OR REPLACE FUNCTION public.has_manage_access(_tenant_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = _tenant_id
      AND user_id = _user_id
      AND role IN ('tenant_admin','manager','bsg_admin')
  ) OR public.is_super_admin(_user_id) OR public.is_bsg_admin(_user_id)
$$;

REVOKE EXECUTE ON FUNCTION public.has_manage_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_manage_access(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. AUDIT TRAIL
-- Logs every platform action: entity_type, entity_id, before/after payload
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_trail (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action        text        NOT NULL,
  entity_type   text        NOT NULL,
  entity_id     uuid,
  payload       jsonb,
  on_behalf_of  uuid        REFERENCES public.tenants(id) ON DELETE SET NULL,
  ip_address    inet,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_trail_tenant_created_idx ON public.audit_trail (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_trail_entity_idx ON public.audit_trail (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_trail_user_idx ON public.audit_trail (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.audit_trail TO authenticated;
GRANT ALL ON public.audit_trail TO service_role;

ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- Super admins + BSG admins see all audit records
CREATE POLICY "audit_super_read" ON public.audit_trail FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid()));

-- Tenant admins see their own tenant's records
CREATE POLICY "audit_tenant_read" ON public.audit_trail FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
  );

-- Any authenticated user can insert (server functions write audit entries)
CREATE POLICY "audit_insert" ON public.audit_trail FOR INSERT TO authenticated
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. SEED BOOST! CLIENT TENANTS
-- Only inserts if slug doesn't exist — safe to re-run
-- Note: real client names not used in public-facing UI, only in admin/internal
-- ---------------------------------------------------------------------------
INSERT INTO public.tenants (
  slug, name, kind,
  brand_primary, brand_secondary,
  welcome_copy, powered_by_boost_footer,
  subscription_tier, modules_enabled
)
VALUES
  ('cccoeo',
   'CCCOEO',
   'client',
   '#0B2545', '#F7941D',
   'Welcome to your BOOST! WorkForce Suite.',
   true,
   'founding',
   '["roles","perform","pulse","learn"]'::jsonb),

  ('cccc-mental-health',
   'CCCC Mental Health Consulting',
   'client',
   '#0B2545', '#F7941D',
   'Welcome to your BOOST! WorkForce Suite.',
   true,
   'founding',
   '["roles","perform","pulse","learn"]'::jsonb),

  ('eskaton',
   'Eskaton Consulting',
   'client',
   '#0B2545', '#F7941D',
   'Welcome to your BOOST! WorkForce Suite.',
   true,
   'founding',
   '["roles","perform","pulse","learn"]'::jsonb)

ON CONFLICT (slug) DO NOTHING;

-- Update BSG root tenant slug/name if it's still 'boost'
UPDATE public.tenants
SET
  name = 'Boost Strategy Group',
  kind = 'root',
  subscription_tier = 'enterprise',
  modules_enabled = '["roles","perform","pulse","learn"]'::jsonb,
  powered_by_boost_footer = false
WHERE slug = 'boost'
  AND kind = 'root';

-- ---------------------------------------------------------------------------
-- 6. EXTEND handle_new_user TO SUPPORT BOOST! TEST ACCOUNTS
-- Adds tenant.admin@boost.test and manager@boost.test role assignments
-- Preserves existing logic for jackie@boost.test, admin@boost.test, learner@boost.test
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email  text := NEW.email;
  v_role   app_role;
  v_tenant_slug text;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', v_email))
  ON CONFLICT (id) DO NOTHING;

  -- Determine role and tenant from email
  IF v_email = 'jackie@boost.test' THEN
    v_role := 'super_admin';
    v_tenant_slug := NULL; -- super_admin has platform-wide access
  ELSIF v_email = 'admin@boost.test' THEN
    v_role := 'bsg_admin';
    v_tenant_slug := NULL;
  ELSIF v_email = 'tenant.admin@boost.test' THEN
    v_role := 'tenant_admin';
    v_tenant_slug := 'cccoeo';
  ELSIF v_email = 'manager@boost.test' THEN
    v_role := 'manager';
    v_tenant_slug := 'cccoeo';
  ELSIF v_email = 'learner@boost.test' THEN
    v_role := 'learner';
    v_tenant_slug := 'cccoeo';
  ELSE
    -- Default new users to learner
    v_role := 'learner';
    v_tenant_slug := NULL;
  END IF;

  -- Insert platform-level role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- If test user has a specific tenant, add to tenant_members
  IF v_tenant_slug IS NOT NULL THEN
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    SELECT t.id, NEW.id, v_role
    FROM public.tenants t
    WHERE t.slug = v_tenant_slug
    ON CONFLICT (tenant_id, user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
