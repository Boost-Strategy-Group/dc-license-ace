-- =============================================================================
-- Migration 2f: Client Onboarding + Reporting Tables
-- Covers: client onboarding sessions, contacts, culture docs, transcripts,
-- report exports, CEO dashboard configs, tenant integrations, AI usage log stub.
-- Order: CREATE TABLE IF NOT EXISTS → GRANT → ENABLE RLS → POLICY
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Client Onboarding Sessions
--    Tracks the structured onboarding journey for each tenant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_onboarding_sessions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assigned_bsg_admin  uuid REFERENCES auth.users(id),    -- BSG staff member owning onboarding
    status              text NOT NULL DEFAULT 'not_started',
                        -- 'not_started','in_progress','completed','on_hold'
    phase               text NOT NULL DEFAULT 'kickoff',
                        -- 'kickoff','data_collection','setup','training','go_live'
    kickoff_date        date,
    target_go_live_date date,
    actual_go_live_date date,
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON client_onboarding_sessions TO authenticated;

ALTER TABLE client_onboarding_sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_client_onboarding_sessions_updated_at
    BEFORE UPDATE ON client_onboarding_sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "onboarding_sessions_super_admin"
    ON client_onboarding_sessions FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "onboarding_sessions_bsg_admin"
    ON client_onboarding_sessions FOR ALL TO authenticated
    USING (has_role('bsg_admin')) WITH CHECK (has_role('bsg_admin'));

CREATE POLICY "onboarding_sessions_tenant_admin_read"
    ON client_onboarding_sessions FOR SELECT TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'));

-- ---------------------------------------------------------------------------
-- 2. Onboarding Steps (checklist within a session)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_steps (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          uuid NOT NULL REFERENCES client_onboarding_sessions(id) ON DELETE CASCADE,
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    step_name           text NOT NULL,
    step_category       text NOT NULL,   -- 'admin_setup','data_import','config','training','launch'
    is_required         boolean NOT NULL DEFAULT true,
    status              text NOT NULL DEFAULT 'pending',  -- 'pending','in_progress','completed','skipped'
    assigned_to         uuid REFERENCES auth.users(id),
    completed_by        uuid REFERENCES auth.users(id),
    completed_at        timestamptz,
    due_date            date,
    notes               text,
    display_order       int NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON onboarding_steps TO authenticated;

ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_onboarding_steps_updated_at
    BEFORE UPDATE ON onboarding_steps
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "onboarding_steps_super_admin"
    ON onboarding_steps FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "onboarding_steps_bsg_admin"
    ON onboarding_steps FOR ALL TO authenticated
    USING (has_role('bsg_admin')) WITH CHECK (has_role('bsg_admin'));

CREATE POLICY "onboarding_steps_tenant_admin_read"
    ON onboarding_steps FOR SELECT TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'));

-- ---------------------------------------------------------------------------
-- 3. Onboarding Contacts (key stakeholders at each client)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_contacts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      uuid NOT NULL REFERENCES client_onboarding_sessions(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         uuid REFERENCES auth.users(id),   -- if they have a platform account
    first_name      text NOT NULL,
    last_name       text NOT NULL,
    email           text NOT NULL,
    phone           text,
    role_title      text,
    contact_type    text NOT NULL DEFAULT 'primary',  -- 'primary','technical','hr','executive'
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON onboarding_contacts TO authenticated;

ALTER TABLE onboarding_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_contacts_super_admin"
    ON onboarding_contacts FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "onboarding_contacts_bsg_admin"
    ON onboarding_contacts FOR ALL TO authenticated
    USING (has_role('bsg_admin')) WITH CHECK (has_role('bsg_admin'));

CREATE POLICY "onboarding_contacts_tenant_admin"
    ON onboarding_contacts FOR ALL TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'))
    WITH CHECK (has_tenant_role(tenant_id, 'tenant_admin'));

-- ---------------------------------------------------------------------------
-- 4. Culture Documents (uploaded by tenant during onboarding or ongoing)
--    Examples: employee handbook, values statement, org chart, job descriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS culture_documents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id      uuid REFERENCES client_onboarding_sessions(id) ON DELETE SET NULL,
    document_type   text NOT NULL DEFAULT 'other',
                    -- 'handbook','values','org_chart','job_desc','policy','other'
    title           text NOT NULL,
    description     text,
    file_path       text,                  -- Supabase Storage path
    file_size_bytes bigint,
    mime_type       text,
    is_active       boolean NOT NULL DEFAULT true,
    uploaded_by     uuid REFERENCES auth.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON culture_documents TO authenticated;

ALTER TABLE culture_documents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_culture_documents_updated_at
    BEFORE UPDATE ON culture_documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "culture_docs_super_admin"
    ON culture_documents FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "culture_docs_bsg_admin"
    ON culture_documents FOR ALL TO authenticated
    USING (has_role('bsg_admin')) WITH CHECK (has_role('bsg_admin'));

CREATE POLICY "culture_docs_tenant_admin"
    ON culture_documents FOR ALL TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'))
    WITH CHECK (has_tenant_role(tenant_id, 'tenant_admin'));

-- Learners can read their own tenant's docs
CREATE POLICY "culture_docs_learner_read"
    ON culture_documents FOR SELECT TO authenticated
    USING (
        is_active = true
        AND is_tenant_member(tenant_id)
    );

-- ---------------------------------------------------------------------------
-- 5. Onboarding Call Transcripts (AI-summarized call notes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_transcripts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      uuid NOT NULL REFERENCES client_onboarding_sessions(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    call_date       date NOT NULL,
    participants    text[] DEFAULT '{}',   -- names/emails of attendees
    raw_transcript  text,                  -- original transcript text
    ai_summary      text,                  -- AI-generated summary (staged draft)
    ai_action_items text[],               -- extracted action items
    is_summary_approved boolean NOT NULL DEFAULT false,
    approved_by     uuid REFERENCES auth.users(id),
    approved_at     timestamptz,
    model_used      text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON onboarding_transcripts TO authenticated;

ALTER TABLE onboarding_transcripts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_onboarding_transcripts_updated_at
    BEFORE UPDATE ON onboarding_transcripts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "transcripts_super_admin"
    ON onboarding_transcripts FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "transcripts_bsg_admin"
    ON onboarding_transcripts FOR ALL TO authenticated
    USING (has_role('bsg_admin')) WITH CHECK (has_role('bsg_admin'));

-- Tenant admin can only read approved summaries — not raw transcripts
CREATE POLICY "transcripts_tenant_admin_read"
    ON onboarding_transcripts FOR SELECT TO authenticated
    USING (
        has_tenant_role(tenant_id, 'tenant_admin')
        AND is_summary_approved = true
    );

-- ---------------------------------------------------------------------------
-- 6. Report Exports (audit trail of all generated reports)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_exports (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    generated_by    uuid NOT NULL REFERENCES auth.users(id),
    report_type     text NOT NULL,
                    -- 'perform_review','pulse_summary','role_analysis','learn_progress',
                    -- 'ceo_dashboard','manager_effectiveness','flight_risk','exit_survey'
    report_params   jsonb NOT NULL DEFAULT '{}',    -- filters/date ranges used
    file_path       text,                           -- Supabase Storage path
    file_format     text NOT NULL DEFAULT 'pdf',    -- 'pdf','csv','xlsx'
    status          text NOT NULL DEFAULT 'pending',-- 'pending','generating','ready','failed'
    row_count       int,
    generated_at    timestamptz,
    expires_at      timestamptz,                    -- auto-delete after N days
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON report_exports TO authenticated;

ALTER TABLE report_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_exports_super_admin"
    ON report_exports FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "report_exports_bsg_admin_read"
    ON report_exports FOR SELECT TO authenticated
    USING (has_role('bsg_admin'));

-- Tenant admin sees their own tenant's reports
CREATE POLICY "report_exports_tenant_admin"
    ON report_exports FOR ALL TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'))
    WITH CHECK (has_tenant_role(tenant_id, 'tenant_admin'));

-- Anyone can see their own generated reports
CREATE POLICY "report_exports_own"
    ON report_exports FOR SELECT TO authenticated
    USING (generated_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. CEO Dashboard Configs (personalized widget layout per tenant_admin)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ceo_dashboard_configs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    widget_layout   jsonb NOT NULL DEFAULT '[]',    -- ordered array of widget configs
    date_range_pref text NOT NULL DEFAULT '30d',    -- '7d','30d','90d','ytd','custom'
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, tenant_id)
);

GRANT SELECT, INSERT, UPDATE ON ceo_dashboard_configs TO authenticated;

ALTER TABLE ceo_dashboard_configs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_ceo_dashboard_configs_updated_at
    BEFORE UPDATE ON ceo_dashboard_configs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "ceo_dashboard_super_admin"
    ON ceo_dashboard_configs FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Each user owns only their own dashboard config
CREATE POLICY "ceo_dashboard_own"
    ON ceo_dashboard_configs FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 8. Tenant Integrations
--    Extends existing `integration_accounts` table concept for BOOST!-specific
--    integration status tracking (Rippling, TalentLMS, BBS, Certifiably, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_integrations (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider            text NOT NULL,
                        -- 'rippling','talenttms','bbs','certifiably','stripe','custom'
    status              text NOT NULL DEFAULT 'not_connected',
                        -- 'not_connected','pending','active','error','disabled'
    credentials_ref     text,           -- reference to vault secret (NOT the secret itself)
    webhook_url         text,           -- outbound webhook endpoint
    webhook_secret_ref  text,           -- vault reference for HMAC secret
    last_sync_at        timestamptz,
    last_error          text,
    config              jsonb NOT NULL DEFAULT '{}',   -- provider-specific settings
    enabled_by          uuid REFERENCES auth.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, provider)
);

GRANT SELECT, INSERT, UPDATE ON tenant_integrations TO authenticated;

ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_tenant_integrations_updated_at
    BEFORE UPDATE ON tenant_integrations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "tenant_integrations_super_admin"
    ON tenant_integrations FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "tenant_integrations_bsg_admin"
    ON tenant_integrations FOR ALL TO authenticated
    USING (has_role('bsg_admin')) WITH CHECK (has_role('bsg_admin'));

-- Tenant admin reads (but cannot write — only BSG admins configure integrations)
CREATE POLICY "tenant_integrations_tenant_admin_read"
    ON tenant_integrations FOR SELECT TO authenticated
    USING (has_tenant_role(tenant_id, 'tenant_admin'));

-- ---------------------------------------------------------------------------
-- 9. AI Usage Log (stub — wired by Lovable developer in Step 7)
--    Tracks every OpenAI API call for cost attribution + tenant isolation audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_usage_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid REFERENCES tenants(id) ON DELETE SET NULL,
    user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    feature         text NOT NULL,     -- 'conversation_coach','goal_coach','pulse_insights', etc.
    model           text NOT NULL,     -- 'gpt-5-mini','gpt-5','text-embedding-3-small'
    prompt_tokens   int NOT NULL DEFAULT 0,
    completion_tokens int NOT NULL DEFAULT 0,
    total_tokens    int NOT NULL DEFAULT 0,
    latency_ms      int,
    success         boolean NOT NULL DEFAULT true,
    error_code      text,
    metadata        jsonb NOT NULL DEFAULT '{}',   -- {tenant_id, user_id, feature} echo
    created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON ai_usage_log TO authenticated;
GRANT SELECT ON ai_usage_log TO authenticated;

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_super_admin"
    ON ai_usage_log FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

-- BSG admins can read for cost analysis
CREATE POLICY "ai_usage_bsg_admin_read"
    ON ai_usage_log FOR SELECT TO authenticated
    USING (has_role('bsg_admin'));

-- Service role inserts are handled by server functions — no additional policy needed
-- Tenant admins get aggregate reporting only (enforced at app layer via report_exports)

-- ---------------------------------------------------------------------------
-- 10. Notification Preferences (per user, per tenant)
--     Controls which in-app and email notifications each user receives
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_preferences (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- Review notifications
    review_due_reminder     boolean NOT NULL DEFAULT true,
    review_submitted        boolean NOT NULL DEFAULT true,
    review_shared           boolean NOT NULL DEFAULT true,
    -- Pulse notifications
    pulse_survey_open       boolean NOT NULL DEFAULT true,
    pulse_reminder          boolean NOT NULL DEFAULT true,
    pulse_results_ready     boolean NOT NULL DEFAULT false,  -- admin only
    -- Learn notifications
    learn_assignment        boolean NOT NULL DEFAULT true,
    learn_due_soon          boolean NOT NULL DEFAULT true,
    learn_certificate       boolean NOT NULL DEFAULT true,
    -- Kudos
    kudos_received          boolean NOT NULL DEFAULT true,
    -- System
    weekly_digest           boolean NOT NULL DEFAULT true,
    updated_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, tenant_id)
);

GRANT SELECT, INSERT, UPDATE ON notification_preferences TO authenticated;

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Each user owns only their own preferences
CREATE POLICY "notif_prefs_own"
    ON notification_preferences FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "notif_prefs_super_admin"
    ON notification_preferences FOR ALL TO authenticated
    USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ---------------------------------------------------------------------------
-- 11. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_tenant   ON client_onboarding_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_session     ON onboarding_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_tenant      ON onboarding_steps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_contacts_tenant   ON onboarding_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_culture_docs_tenant          ON culture_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_session          ON onboarding_transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_tenant           ON onboarding_transcripts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_tenant        ON report_exports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_status        ON report_exports(status);
CREATE INDEX IF NOT EXISTS idx_ceo_dashboard_user           ON ceo_dashboard_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant   ON tenant_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant              ON ai_usage_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature             ON ai_usage_log(feature);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created             ON ai_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user             ON notification_preferences(user_id);
