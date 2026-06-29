-- =============================================================================
-- Migration 2d: BOOST!Pulse Module
-- Creates pulse survey infrastructure SEPARATE from existing surveys table.
-- Existing surveys/pulse_cadences tables are NOT touched.
-- Order: CREATE TABLE IF NOT EXISTS → GRANT → ENABLE RLS → POLICY
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Ensure pgcrypto available (needed for gen_random_uuid where not default)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Survey Dimensions (reference table — seeded below)
--    Sources: GPTW Trust Index, Gallup Q12, Project Aristotle, Edmondson
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pulse_survey_dimensions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL UNIQUE,
    description     text,
    category        text NOT NULL,          -- 'engagement','inclusion','wellbeing','performance','culture'
    source_framework text,                  -- 'GPTW','Gallup','Aristotle','Edmondson','Custom'
    display_order   int NOT NULL DEFAULT 0,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON pulse_survey_dimensions TO authenticated, anon;

ALTER TABLE pulse_survey_dimensions ENABLE ROW LEVEL SECURITY;

-- Dimensions are platform-wide reference data — readable by all authenticated users
CREATE POLICY "pulse_dimensions_read_all"
    ON pulse_survey_dimensions
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "pulse_dimensions_super_admin_write"
    ON pulse_survey_dimensions
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- ---------------------------------------------------------------------------
-- 2. Pulse Survey Templates (tenant-scoped or platform default)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pulse_survey_templates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = platform default
    name            text NOT NULL,
    description     text,
    is_default      boolean NOT NULL DEFAULT false,
    cadence         text NOT NULL DEFAULT 'monthly',    -- 'weekly','bi_weekly','monthly','quarterly'
    question_count  int NOT NULL DEFAULT 5,
    created_by      uuid REFERENCES auth.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON pulse_survey_templates TO authenticated;

ALTER TABLE pulse_survey_templates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_pulse_survey_templates_updated_at
    BEFORE UPDATE ON pulse_survey_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Super admin sees/manages all; tenant admin sees their tenant + platform defaults
CREATE POLICY "pulse_templates_super_admin"
    ON pulse_survey_templates
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

CREATE POLICY "pulse_templates_tenant_admin_read"
    ON pulse_survey_templates
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IS NULL
        OR has_tenant_role(tenant_id, 'tenant_admin')
        OR has_tenant_role(tenant_id, 'manager')
    );

CREATE POLICY "pulse_templates_tenant_admin_write"
    ON pulse_survey_templates
    FOR ALL
    TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'))
    WITH CHECK (has_tenant_role(tenant_id, 'tenant_admin'));

-- ---------------------------------------------------------------------------
-- 3. Pulse Surveys (instances of templates sent to a tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pulse_surveys (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id         uuid REFERENCES pulse_survey_templates(id),
    title               text NOT NULL,
    description         text,
    status              text NOT NULL DEFAULT 'draft',   -- 'draft','active','closed','archived'
    cadence             text NOT NULL DEFAULT 'monthly',
    opens_at            timestamptz,
    closes_at           timestamptz,
    anonymity_threshold int NOT NULL DEFAULT 5,          -- min responses before results shown
    is_anonymous        boolean NOT NULL DEFAULT true,
    send_reminder       boolean NOT NULL DEFAULT true,
    reminder_hours_before int NOT NULL DEFAULT 24,
    created_by          uuid REFERENCES auth.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON pulse_surveys TO authenticated;

ALTER TABLE pulse_surveys ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_pulse_surveys_updated_at
    BEFORE UPDATE ON pulse_surveys
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "pulse_surveys_super_admin"
    ON pulse_surveys
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

CREATE POLICY "pulse_surveys_tenant_admin_all"
    ON pulse_surveys
    FOR ALL
    TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'))
    WITH CHECK (has_tenant_role(tenant_id, 'tenant_admin'));

CREATE POLICY "pulse_surveys_manager_read"
    ON pulse_surveys
    FOR SELECT
    TO authenticated
    USING (has_tenant_role(tenant_id, 'manager'));

-- Learners see active surveys in their tenant
CREATE POLICY "pulse_surveys_learner_active"
    ON pulse_surveys
    FOR SELECT
    TO authenticated
    USING (
        status = 'active'
        AND is_tenant_member(tenant_id)
    );

-- ---------------------------------------------------------------------------
-- 4. Pulse Questions (linked to a survey + dimension)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pulse_questions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id       uuid NOT NULL REFERENCES pulse_surveys(id) ON DELETE CASCADE,
    dimension_id    uuid REFERENCES pulse_survey_dimensions(id),
    question_text   text NOT NULL,
    question_type   text NOT NULL DEFAULT 'likert',   -- 'likert','open_text','yes_no','rating'
    scale_min       int NOT NULL DEFAULT 1,
    scale_max       int NOT NULL DEFAULT 5,
    scale_min_label text,
    scale_max_label text,
    display_order   int NOT NULL DEFAULT 0,
    is_required     boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON pulse_questions TO authenticated;

ALTER TABLE pulse_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pulse_questions_super_admin"
    ON pulse_questions
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

CREATE POLICY "pulse_questions_tenant_read"
    ON pulse_questions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM pulse_surveys ps
            WHERE ps.id = survey_id
            AND is_tenant_member(ps.tenant_id)
        )
    );

CREATE POLICY "pulse_questions_tenant_admin_write"
    ON pulse_questions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM pulse_surveys ps
            WHERE ps.id = survey_id
            AND has_tenant_role(ps.tenant_id, 'tenant_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pulse_surveys ps
            WHERE ps.id = survey_id
            AND has_tenant_role(ps.tenant_id, 'tenant_admin')
        )
    );

-- ---------------------------------------------------------------------------
-- 5. Pulse Responses (one row per respondent per survey)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pulse_responses (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id       uuid NOT NULL REFERENCES pulse_surveys(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    respondent_id   uuid REFERENCES auth.users(id),    -- NULL if fully anonymous
    -- Hashed identifier so we can detect duplicates without storing identity
    respondent_hash text,
    status          text NOT NULL DEFAULT 'in_progress',  -- 'in_progress','submitted'
    submitted_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (survey_id, respondent_hash)
);

GRANT SELECT, INSERT, UPDATE ON pulse_responses TO authenticated;

ALTER TABLE pulse_responses ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_pulse_responses_updated_at
    BEFORE UPDATE ON pulse_responses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Super admin only sees aggregate counts — not individual responses (enforced at app layer)
CREATE POLICY "pulse_responses_super_admin"
    ON pulse_responses
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Tenant admin: see their tenant's responses (anonymity enforced at app layer via threshold)
CREATE POLICY "pulse_responses_tenant_admin_read"
    ON pulse_responses
    FOR SELECT
    TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'));

-- Learner: can only insert/update their own response
CREATE POLICY "pulse_responses_learner_own"
    ON pulse_responses
    FOR ALL
    TO authenticated
    USING (
        is_tenant_member(tenant_id)
        AND (respondent_id = auth.uid() OR respondent_id IS NULL)
    )
    WITH CHECK (
        is_tenant_member(tenant_id)
        AND (respondent_id = auth.uid() OR respondent_id IS NULL)
    );

-- ---------------------------------------------------------------------------
-- 6. Pulse Response Answers (one row per question per response)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pulse_response_answers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id     uuid NOT NULL REFERENCES pulse_responses(id) ON DELETE CASCADE,
    question_id     uuid NOT NULL REFERENCES pulse_questions(id) ON DELETE CASCADE,
    numeric_value   int,                   -- for likert / rating / yes_no (1=yes, 0=no)
    text_value      text,                  -- for open_text
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (response_id, question_id)
);

GRANT SELECT, INSERT, UPDATE ON pulse_response_answers TO authenticated;

ALTER TABLE pulse_response_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pulse_answers_super_admin"
    ON pulse_response_answers
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

CREATE POLICY "pulse_answers_tenant_admin_read"
    ON pulse_response_answers
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM pulse_responses pr
            JOIN pulse_surveys ps ON ps.id = pr.survey_id
            WHERE pr.id = response_id
            AND has_tenant_role(ps.tenant_id, 'tenant_admin')
        )
    );

CREATE POLICY "pulse_answers_respondent_own"
    ON pulse_response_answers
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM pulse_responses pr
            WHERE pr.id = response_id
            AND (pr.respondent_id = auth.uid() OR pr.respondent_id IS NULL)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pulse_responses pr
            WHERE pr.id = response_id
            AND (pr.respondent_id = auth.uid() OR pr.respondent_id IS NULL)
        )
    );

-- ---------------------------------------------------------------------------
-- 7. Pulse Dimension Scores (computed/cached per survey × dimension)
--    Only shown when response_count >= anonymity_threshold
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pulse_dimension_scores (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id       uuid NOT NULL REFERENCES pulse_surveys(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    dimension_id    uuid NOT NULL REFERENCES pulse_survey_dimensions(id),
    response_count  int NOT NULL DEFAULT 0,
    avg_score       numeric(4,2),
    benchmark_score numeric(4,2),          -- industry benchmark for comparison
    score_delta     numeric(4,2),          -- change from previous period
    computed_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (survey_id, dimension_id)
);

GRANT SELECT, INSERT, UPDATE ON pulse_dimension_scores TO authenticated;

ALTER TABLE pulse_dimension_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pulse_dim_scores_super_admin"
    ON pulse_dimension_scores
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Only show scores if response_count >= threshold (anonymity guard)
CREATE POLICY "pulse_dim_scores_tenant_read"
    ON pulse_dimension_scores
    FOR SELECT
    TO authenticated
    USING (
        has_tenant_role(tenant_id, 'tenant_admin')
        AND EXISTS (
            SELECT 1 FROM pulse_surveys ps
            WHERE ps.id = survey_id
            AND response_count >= ps.anonymity_threshold
        )
    );

-- ---------------------------------------------------------------------------
-- 8. AI Pulse Insights (per survey, tenant-scoped, staged as drafts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pulse_ai_insights (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id       uuid NOT NULL REFERENCES pulse_surveys(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    insight_type    text NOT NULL DEFAULT 'summary',  -- 'summary','trend','recommendation','risk'
    content         text NOT NULL,
    model_used      text,
    is_published    boolean NOT NULL DEFAULT false,   -- must be admin-approved before showing
    generated_at    timestamptz NOT NULL DEFAULT now(),
    published_by    uuid REFERENCES auth.users(id),
    published_at    timestamptz
);

GRANT SELECT, INSERT, UPDATE ON pulse_ai_insights TO authenticated;

ALTER TABLE pulse_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pulse_insights_super_admin"
    ON pulse_ai_insights
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Tenant admin sees all insights for their tenant (published + unpublished)
CREATE POLICY "pulse_insights_tenant_admin"
    ON pulse_ai_insights
    FOR ALL
    TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'))
    WITH CHECK (has_tenant_role(tenant_id, 'tenant_admin'));

-- Managers see only published insights
CREATE POLICY "pulse_insights_manager_read"
    ON pulse_ai_insights
    FOR SELECT
    TO authenticated
    USING (
        is_published = true
        AND has_tenant_role(tenant_id, 'manager')
    );

-- ---------------------------------------------------------------------------
-- 9. SEED: 15 Survey Dimensions
--    Drawn from: GPTW Trust Index (6), Gallup Q12 (4), Project Aristotle (3),
--    Edmondson Psychological Safety (1), Custom (1)
-- ---------------------------------------------------------------------------
INSERT INTO pulse_survey_dimensions (name, description, category, source_framework, display_order) VALUES
    -- GPTW Trust Index
    ('Credibility',         'Employees believe management is honest and ethical',                          'culture',     'GPTW',       1),
    ('Respect',             'Employees feel they are treated with respect and dignity',                    'culture',     'GPTW',       2),
    ('Fairness',            'Employees perceive equity in rewards, opportunities, and treatment',          'culture',     'GPTW',       3),
    ('Pride',               'Employees feel pride in their work, team, and organization',                  'engagement',  'GPTW',       4),
    ('Camaraderie',         'Employees experience genuine connection and belonging with colleagues',        'inclusion',   'GPTW',       5),
    ('Innovation',          'Employees feel encouraged to contribute ideas and try new approaches',         'performance', 'GPTW',       6),
    -- Gallup Q12
    ('Role Clarity',        'Employees know what is expected of them at work',                             'performance', 'Gallup',     7),
    ('Resources & Support', 'Employees have the materials and support needed to do their work right',      'performance', 'Gallup',     8),
    ('Recognition',         'Employees receive recognition or praise for doing good work',                 'engagement',  'Gallup',     9),
    ('Growth & Development','Employees have opportunities to learn and grow professionally',                'engagement',  'Gallup',    10),
    -- Project Aristotle (Google)
    ('Psychological Safety','Team members feel safe to take risks and be vulnerable with one another',     'inclusion',   'Edmondson',  11),
    ('Dependability',       'Team members reliably complete quality work on time',                         'performance', 'Aristotle',  12),
    ('Meaning',             'Work is personally significant to team members',                              'engagement',  'Aristotle',  13),
    -- Wellbeing
    ('Wellbeing & Balance', 'Employees feel supported in managing workload and personal wellness',         'wellbeing',   'Custom',     14),
    -- Manager Effectiveness (links to perform module)
    ('Manager Effectiveness','Direct reports feel supported, coached, and fairly evaluated by managers',   'performance', 'Custom',     15)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pulse_surveys_tenant         ON pulse_surveys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pulse_surveys_status         ON pulse_surveys(status);
CREATE INDEX IF NOT EXISTS idx_pulse_questions_survey       ON pulse_questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_pulse_responses_survey       ON pulse_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_pulse_responses_tenant       ON pulse_responses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pulse_answers_response       ON pulse_response_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_pulse_dim_scores_survey      ON pulse_dimension_scores(survey_id);
CREATE INDEX IF NOT EXISTS idx_pulse_dim_scores_tenant      ON pulse_dimension_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pulse_insights_tenant        ON pulse_ai_insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pulse_insights_survey        ON pulse_ai_insights(survey_id);
