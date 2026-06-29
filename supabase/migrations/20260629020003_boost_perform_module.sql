-- =============================================================================
-- BOOST! My WorkForce Suite — Migration 2c: Boost!Perform Module
-- Tables: perform_review_sections, perform_reviews (full spec),
--         perform_targets (extends perform_goals), potential_ratings,
--         bonus_pool_configs, training_recommendations,
--         conversation_coach_sessions, employee_goal_coach_sessions,
--         kudos, exit_surveys, manager_effectiveness_scores
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. PERFORM REVIEW SECTIONS CONFIG (per-tenant, per-cycle)
-- Supports: Targets + Competencies + up to 3 custom sections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perform_review_sections (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cycle_id      uuid        REFERENCES public.perform_review_cycles(id) ON DELETE CASCADE,
  section_name  text        NOT NULL,
  section_type  text        NOT NULL DEFAULT 'custom'
                            CHECK (section_type IN ('targets','competencies','custom')),
  display_order integer     NOT NULL DEFAULT 0,
  weight        numeric(5,2) NOT NULL DEFAULT 0
                            CHECK (weight >= 0 AND weight <= 100),
  is_required   boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS perform_review_sections_tenant_idx ON public.perform_review_sections (tenant_id, cycle_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perform_review_sections TO authenticated;
GRANT ALL ON public.perform_review_sections TO service_role;

ALTER TABLE public.perform_review_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_sections_read" ON public.perform_review_sections FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
         OR public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "review_sections_write" ON public.perform_review_sections FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
              OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));

CREATE TRIGGER perform_review_sections_updated_at BEFORE UPDATE ON public.perform_review_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. PERFORM REVIEWS (full BOOST! spec)
-- Note: perform_review_cycles already exists from prior migration
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perform_reviews (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cycle_id                uuid        REFERENCES public.perform_review_cycles(id) ON DELETE SET NULL,
  learner_id              uuid        NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  reviewer_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                  text        NOT NULL DEFAULT 'draft'
                                      CHECK (status IN ('draft','submitted','acknowledged')),
  -- Section ratings stored as JSONB: { "section_id": { "score": 3.5, "comments": "..." } }
  target_ratings          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  competency_ratings      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  custom_section_ratings  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  overall_rating          numeric(4,2),
  weighted_score          numeric(4,2),
  overall_comments        text,
  development_plan        text,
  acknowledged_at         timestamptz,
  submitted_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS perform_reviews_tenant_idx ON public.perform_reviews (tenant_id, cycle_id);
CREATE INDEX IF NOT EXISTS perform_reviews_learner_idx ON public.perform_reviews (learner_id);
CREATE INDEX IF NOT EXISTS perform_reviews_reviewer_idx ON public.perform_reviews (reviewer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perform_reviews TO authenticated;
GRANT ALL ON public.perform_reviews TO service_role;

ALTER TABLE public.perform_reviews ENABLE ROW LEVEL SECURITY;

-- Employees can read their own reviews; managers read their team's; admin reads all
CREATE POLICY "perform_reviews_read" ON public.perform_reviews FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR reviewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = learner_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "perform_reviews_write" ON public.perform_reviews FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR reviewer_id = auth.uid()
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR reviewer_id = auth.uid()
  );

CREATE TRIGGER perform_reviews_updated_at BEFORE UPDATE ON public.perform_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. PERFORM TARGETS (BOOST! name for goals — extends existing perform_goals)
-- Note: "Targets" is the user-facing name; perform_targets is the table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perform_targets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  learner_id    uuid        NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  cycle_id      uuid        REFERENCES public.perform_review_cycles(id) ON DELETE SET NULL,
  review_id     uuid        REFERENCES public.perform_reviews(id) ON DELETE SET NULL,
  title         text        NOT NULL,
  description   text,
  due_date      date,
  weight        numeric(5,2) NOT NULL DEFAULT 0
                            CHECK (weight >= 0 AND weight <= 100),
  progress_pct  integer     NOT NULL DEFAULT 0
                            CHECK (progress_pct >= 0 AND progress_pct <= 100),
  status        text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','completed','cancelled','deferred')),
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS perform_targets_learner_idx ON public.perform_targets (learner_id, cycle_id);
CREATE INDEX IF NOT EXISTS perform_targets_tenant_idx ON public.perform_targets (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perform_targets TO authenticated;
GRANT ALL ON public.perform_targets TO service_role;

ALTER TABLE public.perform_targets ENABLE ROW LEVEL SECURITY;

-- Employees manage their own targets; managers + admins read all team targets
CREATE POLICY "perform_targets_read" ON public.perform_targets FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR public.has_tenant_role(tenant_id, auth.uid(), 'manager')
    OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = learner_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "perform_targets_write" ON public.perform_targets FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR public.has_tenant_role(tenant_id, auth.uid(), 'manager')
    OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = learner_id AND l.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR public.has_tenant_role(tenant_id, auth.uid(), 'manager')
    OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = learner_id AND l.user_id = auth.uid()
    )
  );

CREATE TRIGGER perform_targets_updated_at BEFORE UPDATE ON public.perform_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. POTENTIAL RATINGS (for 9-box Y-axis)
-- 3 factors: learning_agility + aspiration + capability_ceiling (each 1-3)
-- Composite: average → Low(1-1.6) / Medium(1.7-2.3) / High(2.4-3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.potential_ratings (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  learner_id           uuid        NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  cycle_id             uuid        REFERENCES public.perform_review_cycles(id) ON DELETE SET NULL,
  learning_agility     integer     NOT NULL CHECK (learning_agility BETWEEN 1 AND 3),
  aspiration           integer     NOT NULL CHECK (aspiration BETWEEN 1 AND 3),
  capability_ceiling   integer     NOT NULL CHECK (capability_ceiling BETWEEN 1 AND 3),
  -- Computed: (learning_agility + aspiration + capability_ceiling) / 3
  composite_score      numeric(4,2) GENERATED ALWAYS AS
                         (ROUND((learning_agility + aspiration + capability_ceiling)::numeric / 3, 2))
                         STORED,
  -- Derived level based on composite_score
  potential_level      text        GENERATED ALWAYS AS (
                         CASE
                           WHEN (learning_agility + aspiration + capability_ceiling)::numeric / 3 >= 2.4 THEN 'high'
                           WHEN (learning_agility + aspiration + capability_ceiling)::numeric / 3 >= 1.7 THEN 'medium'
                           ELSE 'low'
                         END
                       ) STORED,
  rated_by             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, learner_id, cycle_id)
);
CREATE INDEX IF NOT EXISTS potential_ratings_tenant_idx ON public.potential_ratings (tenant_id, cycle_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.potential_ratings TO authenticated;
GRANT ALL ON public.potential_ratings TO service_role;

ALTER TABLE public.potential_ratings ENABLE ROW LEVEL SECURITY;

-- Managers and admins only — employees do not see their own potential rating
CREATE POLICY "potential_ratings_read" ON public.potential_ratings FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR public.has_tenant_role(tenant_id, auth.uid(), 'manager')
  );

CREATE POLICY "potential_ratings_write" ON public.potential_ratings FOR ALL TO authenticated
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

CREATE TRIGGER potential_ratings_updated_at BEFORE UPDATE ON public.potential_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. BONUS POOL CONFIGS
-- Supports 3 methods: nine_box, percent_salary, flat_per_tier
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bonus_pool_configs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cycle_id      uuid        REFERENCES public.perform_review_cycles(id) ON DELETE SET NULL,
  method        text        NOT NULL
                            CHECK (method IN ('nine_box','percent_salary','flat_per_tier')),
  -- config_params holds method-specific config:
  -- nine_box: { "star": 0.20, "core": 0.10, ... }
  -- percent_salary: { "high": 0.10, "meets": 0.05, "below": 0 }
  -- flat_per_tier: { "high": 2000, "meets": 1000, "below": 0 }
  config_params jsonb       NOT NULL DEFAULT '{}'::jsonb,
  total_pool    numeric(14,2),
  finalized     boolean     NOT NULL DEFAULT false,
  finalized_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  finalized_at  timestamptz,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bonus_pool_configs_tenant_idx ON public.bonus_pool_configs (tenant_id, cycle_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bonus_pool_configs TO authenticated;
GRANT ALL ON public.bonus_pool_configs TO service_role;

ALTER TABLE public.bonus_pool_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bonus_pool_read" ON public.bonus_pool_configs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));

CREATE POLICY "bonus_pool_write" ON public.bonus_pool_configs FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
              OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));

CREATE TRIGGER bonus_pool_configs_updated_at BEFORE UPDATE ON public.bonus_pool_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. TRAINING RECOMMENDATIONS (AI-generated, post-review)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_recommendations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  learner_id       uuid        NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  review_id        uuid        REFERENCES public.perform_reviews(id) ON DELETE SET NULL,
  recommendations  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  source           text        NOT NULL DEFAULT 'ai_generated'
                               CHECK (source IN ('ai_generated','manager_override')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS training_recs_learner_idx ON public.training_recommendations (learner_id);
CREATE INDEX IF NOT EXISTS training_recs_tenant_idx ON public.training_recommendations (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_recommendations TO authenticated;
GRANT ALL ON public.training_recommendations TO service_role;

ALTER TABLE public.training_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_recs_read" ON public.training_recommendations FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR public.has_tenant_role(tenant_id, auth.uid(), 'manager')
    OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = learner_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "training_recs_write" ON public.training_recommendations FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
         OR public.has_tenant_role(tenant_id, auth.uid(), 'manager'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
              OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
              OR public.has_tenant_role(tenant_id, auth.uid(), 'manager'));

-- ---------------------------------------------------------------------------
-- 7. CONVERSATION COACH SESSIONS
-- CRITICAL: manager-only — employee must NEVER see this data
-- PDF = download + print only; no share, no email, no send
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_coach_sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  manager_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id        uuid        NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  conversation_type text        NOT NULL DEFAULT 'performance_review'
                                CHECK (conversation_type IN (
                                  'performance_review','development','difficult','recognition'
                                )),
  ai_starters       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  manager_notes     text,
  pdf_downloaded_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conv_coach_manager_idx ON public.conversation_coach_sessions (manager_id, tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_coach_sessions TO authenticated;
GRANT ALL ON public.conversation_coach_sessions TO service_role;

ALTER TABLE public.conversation_coach_sessions ENABLE ROW LEVEL SECURITY;

-- ONLY the manager who created it + admins — employees never see this
CREATE POLICY "conv_coach_manager_only_read" ON public.conversation_coach_sessions FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR manager_id = auth.uid()
  );

CREATE POLICY "conv_coach_manager_only_write" ON public.conversation_coach_sessions FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR manager_id = auth.uid()
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR manager_id = auth.uid()
  );

CREATE TRIGGER conv_coach_updated_at BEFORE UPDATE ON public.conversation_coach_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. EMPLOYEE GOAL COACH SESSIONS (beta — toggleable per tenant + per employee)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_goal_coach_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  learner_id  uuid        NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  target_id   uuid        REFERENCES public.perform_targets(id) ON DELETE SET NULL,
  prompt      text,
  ai_response text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goal_coach_learner_idx ON public.employee_goal_coach_sessions (learner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_goal_coach_sessions TO authenticated;
GRANT ALL ON public.employee_goal_coach_sessions TO service_role;

ALTER TABLE public.employee_goal_coach_sessions ENABLE ROW LEVEL SECURITY;

-- Employees see only their own sessions
CREATE POLICY "goal_coach_self_read" ON public.employee_goal_coach_sessions FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = learner_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "goal_coach_self_write" ON public.employee_goal_coach_sessions FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = learner_id AND l.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = learner_id AND l.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 9. KUDOS
-- Public recognition; rolls into performance review as supporting evidence
-- GUARDRAIL: flight_risk_flag requires admin socialization + data threshold
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kudos (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_learner_id     uuid        NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  message           text        NOT NULL,
  category          text        NOT NULL DEFAULT 'general'
                                CHECK (category IN (
                                  'leadership','teamwork','innovation','client_service',
                                  'above_and_beyond','general'
                                )),
  is_public         boolean     NOT NULL DEFAULT true,
  -- flight_risk_flag: ONLY set by system when threshold met AND admin has socialized
  -- Never auto-flag — always require deliberate admin action
  flight_risk_flag  boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kudos_tenant_idx ON public.kudos (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS kudos_to_learner_idx ON public.kudos (to_learner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kudos TO authenticated;
GRANT ALL ON public.kudos TO service_role;

ALTER TABLE public.kudos ENABLE ROW LEVEL SECURITY;

-- Public kudos visible to all tenant members; private kudos only to sender/admin
CREATE POLICY "kudos_read" ON public.kudos FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR (is_public = true AND public.is_tenant_member(tenant_id, auth.uid()))
    OR from_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = to_learner_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "kudos_insert" ON public.kudos FOR INSERT TO authenticated
  WITH CHECK (
    from_user_id = auth.uid()
    AND public.is_tenant_member(tenant_id, auth.uid())
  );

-- Only admins can update (e.g., to set flight_risk_flag)
CREATE POLICY "kudos_admin_update" ON public.kudos FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
  );

-- ---------------------------------------------------------------------------
-- 10. EXIT SURVEYS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exit_surveys (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  learner_id        uuid        NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  voluntary         boolean     NOT NULL DEFAULT true,
  responses         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ai_summary        text,
  rehire_eligible   boolean,
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exit_surveys_tenant_idx ON public.exit_surveys (tenant_id);
CREATE INDEX IF NOT EXISTS exit_surveys_learner_idx ON public.exit_surveys (learner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exit_surveys TO authenticated;
GRANT ALL ON public.exit_surveys TO service_role;

ALTER TABLE public.exit_surveys ENABLE ROW LEVEL SECURITY;

-- Employee inserts own; admins read all
CREATE POLICY "exit_surveys_read" ON public.exit_surveys FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = learner_id AND l.user_id = auth.uid()
    )
  );

CREATE POLICY "exit_surveys_insert" ON public.exit_surveys FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
    OR EXISTS (
      SELECT 1 FROM public.learners l
      WHERE l.id = learner_id AND l.user_id = auth.uid()
    )
  );

-- Only admins update (to set rehire_eligible, ai_summary)
CREATE POLICY "exit_surveys_admin_update" ON public.exit_surveys FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
              OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));

-- ---------------------------------------------------------------------------
-- 11. MANAGER EFFECTIVENESS SCORES (foundational — not surfaced to managers yet)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manager_effectiveness_scores (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  manager_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_id      uuid        REFERENCES public.perform_review_cycles(id) ON DELETE SET NULL,
  score         numeric(4,2),
  -- sub_scores: { "clarity": 3.5, "development": 4.0, "recognition": 3.0, "accountability": 4.5 }
  sub_scores    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mgr_effectiveness_tenant_idx ON public.manager_effectiveness_scores (tenant_id, cycle_id);
CREATE UNIQUE INDEX IF NOT EXISTS mgr_effectiveness_unique ON public.manager_effectiveness_scores (tenant_id, manager_id, cycle_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manager_effectiveness_scores TO authenticated;
GRANT ALL ON public.manager_effectiveness_scores TO service_role;

ALTER TABLE public.manager_effectiveness_scores ENABLE ROW LEVEL SECURITY;

-- Admins only — managers do NOT see their own effectiveness score yet
CREATE POLICY "mgr_effectiveness_admin_only" ON public.manager_effectiveness_scores FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR public.is_bsg_admin(auth.uid())
    OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
  );
