-- =============================================================================
-- Migration 2e: BOOST!Learn Extensions
-- Extends existing courses/enrollments/modules/lessons/assessments tables
-- with BOOST!Learn-specific fields. Does NOT recreate existing tables.
-- Also adds: learning_paths, certifications stub, content_library.
-- Order: ADD COLUMN IF NOT EXISTS → new tables → GRANT → RLS → POLICY
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend existing `courses` table (BOOST!Learn overlay)
-- ---------------------------------------------------------------------------
ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS tenant_id          uuid REFERENCES tenants(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS module_tag         text DEFAULT 'learn',    -- 'roles','perform','pulse','learn'
    ADD COLUMN IF NOT EXISTS skill_tags         text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS estimated_hours    numeric(5,2),
    ADD COLUMN IF NOT EXISTS difficulty_level   text DEFAULT 'beginner', -- 'beginner','intermediate','advanced'
    ADD COLUMN IF NOT EXISTS is_published       boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS published_at       timestamptz,
    ADD COLUMN IF NOT EXISTS thumbnail_url      text,
    ADD COLUMN IF NOT EXISTS certificate_template_id uuid,               -- FK added below
    ADD COLUMN IF NOT EXISTS passing_score_pct  int NOT NULL DEFAULT 80,
    ADD COLUMN IF NOT EXISTS allow_retakes      boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS max_retakes        int,                      -- NULL = unlimited
    ADD COLUMN IF NOT EXISTS created_by         uuid REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS archived_at        timestamptz;

CREATE INDEX IF NOT EXISTS idx_courses_tenant ON courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_module_tag ON courses(module_tag);

-- ---------------------------------------------------------------------------
-- 2. Extend existing `enrollments` table
-- ---------------------------------------------------------------------------
ALTER TABLE enrollments
    ADD COLUMN IF NOT EXISTS tenant_id          uuid REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS enrolled_by        uuid REFERENCES auth.users(id),  -- who triggered enrollment
    ADD COLUMN IF NOT EXISTS enrollment_type    text DEFAULT 'self',    -- 'self','assigned','auto'
    ADD COLUMN IF NOT EXISTS due_date           date,
    ADD COLUMN IF NOT EXISTS completed_at       timestamptz,
    ADD COLUMN IF NOT EXISTS score_pct          int,                    -- final assessment score
    ADD COLUMN IF NOT EXISTS certificate_issued boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS certificate_issued_at timestamptz,
    ADD COLUMN IF NOT EXISTS retake_count       int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_enrollments_tenant ON enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_due_date ON enrollments(due_date);

-- ---------------------------------------------------------------------------
-- 3. Extend existing `assessments` table
-- ---------------------------------------------------------------------------
ALTER TABLE assessments
    ADD COLUMN IF NOT EXISTS tenant_id          uuid REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS passing_score_pct  int NOT NULL DEFAULT 80,
    ADD COLUMN IF NOT EXISTS time_limit_minutes int,                     -- NULL = no limit
    ADD COLUMN IF NOT EXISTS shuffle_questions  boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS show_correct_answers boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS assessment_type    text DEFAULT 'quiz';    -- 'quiz','pre','post','final'

-- ---------------------------------------------------------------------------
-- 4. Learning Paths (curated sequences of courses)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_paths (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,   -- NULL = platform-wide
    name            text NOT NULL,
    description     text,
    role_target     text,                                             -- ties to job_descriptions.title
    skill_tags      text[] DEFAULT '{}',
    is_published    boolean NOT NULL DEFAULT false,
    estimated_hours numeric(6,2),
    created_by      uuid REFERENCES auth.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON learning_paths TO authenticated;

ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_learning_paths_updated_at
    BEFORE UPDATE ON learning_paths
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "learning_paths_super_admin"
    ON learning_paths FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "learning_paths_tenant_admin_write"
    ON learning_paths FOR ALL TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'))
    WITH CHECK (has_tenant_role(tenant_id, 'tenant_admin'));

CREATE POLICY "learning_paths_learner_read"
    ON learning_paths FOR SELECT TO authenticated
    USING (
        is_published = true
        AND (tenant_id IS NULL OR is_tenant_member(tenant_id))
    );

-- ---------------------------------------------------------------------------
-- 5. Learning Path Courses (junction — ordered)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_path_courses (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id         uuid NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
    course_id       uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    display_order   int NOT NULL DEFAULT 0,
    is_required     boolean NOT NULL DEFAULT true,
    UNIQUE (path_id, course_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON learning_path_courses TO authenticated;

ALTER TABLE learning_path_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp_courses_super_admin"
    ON learning_path_courses FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "lp_courses_tenant_admin_write"
    ON learning_path_courses FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM learning_paths lp
            WHERE lp.id = path_id
            AND has_tenant_role(lp.tenant_id, 'tenant_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM learning_paths lp
            WHERE lp.id = path_id
            AND has_tenant_role(lp.tenant_id, 'tenant_admin')
        )
    );

CREATE POLICY "lp_courses_learner_read"
    ON learning_path_courses FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM learning_paths lp
            WHERE lp.id = path_id AND is_published = true
        )
    );

-- ---------------------------------------------------------------------------
-- 6. Learning Path Enrollments (user enrolled in a full path)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_path_enrollments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id         uuid NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    enrolled_by     uuid REFERENCES auth.users(id),
    status          text NOT NULL DEFAULT 'in_progress',  -- 'in_progress','completed','dropped'
    progress_pct    int NOT NULL DEFAULT 0,
    completed_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (path_id, user_id)
);

GRANT SELECT, INSERT, UPDATE ON learning_path_enrollments TO authenticated;

ALTER TABLE learning_path_enrollments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_lp_enrollments_updated_at
    BEFORE UPDATE ON learning_path_enrollments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "lp_enrollments_super_admin"
    ON learning_path_enrollments FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "lp_enrollments_admin_read"
    ON learning_path_enrollments FOR SELECT TO authenticated
    USING (
        has_tenant_role(tenant_id, 'tenant_admin')
        OR has_tenant_role(tenant_id, 'manager')
    );

CREATE POLICY "lp_enrollments_own"
    ON learning_path_enrollments FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. Certificate Templates (stub — Certifiably integration via webhook)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificate_templates (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = platform default
    name                text NOT NULL,
    provider            text NOT NULL DEFAULT 'internal',  -- 'internal','certifiably'
    external_template_id text,                             -- Certifiably template ID
    issued_by_name      text NOT NULL DEFAULT 'BSG BOOST!',
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON certificate_templates TO authenticated;

ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;

-- Add FK from courses to certificate_templates (now that the table exists)
ALTER TABLE courses
    ADD CONSTRAINT fk_courses_cert_template
    FOREIGN KEY (certificate_template_id) REFERENCES certificate_templates(id)
    ON DELETE SET NULL
    NOT VALID;   -- NOT VALID: avoids locking on existing rows

CREATE POLICY "cert_templates_super_admin"
    ON certificate_templates FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "cert_templates_tenant_admin"
    ON certificate_templates FOR ALL TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'))
    WITH CHECK (has_tenant_role(tenant_id, 'tenant_admin'));

CREATE POLICY "cert_templates_learner_read"
    ON certificate_templates FOR SELECT TO authenticated
    USING (
        is_active = true
        AND (tenant_id IS NULL OR is_tenant_member(tenant_id))
    );

-- ---------------------------------------------------------------------------
-- 8. Issued Certificates (record of certificates granted to learners)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issued_certificates (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    course_id               uuid REFERENCES courses(id) ON DELETE SET NULL,
    template_id             uuid REFERENCES certificate_templates(id) ON DELETE SET NULL,
    enrollment_id           uuid REFERENCES enrollments(id) ON DELETE SET NULL,
    certificate_number      text UNIQUE,                   -- human-readable unique ID
    issued_at               timestamptz NOT NULL DEFAULT now(),
    expires_at              timestamptz,                   -- NULL = no expiry
    pdf_url                 text,                          -- stored in Supabase Storage
    external_certificate_id text,                         -- Certifiably ID when applicable
    revoked_at              timestamptz,
    revoked_reason          text
);

GRANT SELECT, INSERT, UPDATE ON issued_certificates TO authenticated;

ALTER TABLE issued_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "issued_certs_super_admin"
    ON issued_certificates FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "issued_certs_tenant_admin_read"
    ON issued_certificates FOR SELECT TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'));

CREATE POLICY "issued_certs_own"
    ON issued_certificates FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 9. Content Library (BSG-curated shared resources across tenants)
--    Separate from course modules — these are supplemental reference materials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_library (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,   -- NULL = platform-wide
    title           text NOT NULL,
    description     text,
    content_type    text NOT NULL DEFAULT 'article',  -- 'article','video','pdf','link','template'
    url             text,
    file_path       text,                             -- Supabase Storage path
    module_tag      text DEFAULT 'learn',
    skill_tags      text[] DEFAULT '{}',
    is_published    boolean NOT NULL DEFAULT false,
    view_count      int NOT NULL DEFAULT 0,
    created_by      uuid REFERENCES auth.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON content_library TO authenticated;

ALTER TABLE content_library ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_content_library_updated_at
    BEFORE UPDATE ON content_library
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "content_lib_super_admin"
    ON content_library FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "content_lib_tenant_admin_write"
    ON content_library FOR ALL TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'))
    WITH CHECK (has_tenant_role(tenant_id, 'tenant_admin'));

CREATE POLICY "content_lib_learner_read"
    ON content_library FOR SELECT TO authenticated
    USING (
        is_published = true
        AND (tenant_id IS NULL OR is_tenant_member(tenant_id))
    );

-- ---------------------------------------------------------------------------
-- 10. AI Learning Recommendations (linked to perform module's training_recommendations)
--     Tracks which courses were recommended by AI + whether learner acted on them
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learn_ai_recommendations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    training_rec_id     uuid REFERENCES training_recommendations(id) ON DELETE SET NULL,
    recommended_course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
    recommended_path_id   uuid REFERENCES learning_paths(id) ON DELETE SET NULL,
    reason              text,            -- AI-generated rationale
    confidence_score    numeric(3,2),    -- 0.00–1.00
    status              text NOT NULL DEFAULT 'pending',  -- 'pending','enrolled','dismissed','completed'
    acted_at            timestamptz,
    model_used          text,
    generated_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON learn_ai_recommendations TO authenticated;

ALTER TABLE learn_ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learn_ai_recs_super_admin"
    ON learn_ai_recommendations FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "learn_ai_recs_admin_read"
    ON learn_ai_recommendations FOR SELECT TO authenticated
    USING (
        has_tenant_role(tenant_id, 'tenant_admin')
        OR has_tenant_role(tenant_id, 'manager')
    );

CREATE POLICY "learn_ai_recs_own"
    ON learn_ai_recommendations FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 11. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_learning_paths_tenant     ON learning_paths(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lp_enrollments_user       ON learning_path_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_lp_enrollments_tenant     ON learning_path_enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_user         ON issued_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_tenant       ON issued_certificates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_lib_tenant        ON content_library(tenant_id);
CREATE INDEX IF NOT EXISTS idx_learn_ai_recs_user        ON learn_ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_learn_ai_recs_tenant      ON learn_ai_recommendations(tenant_id);
