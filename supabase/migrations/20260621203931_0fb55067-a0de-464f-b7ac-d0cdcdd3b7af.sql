
-- =========================================================================
-- TENANTS
-- =========================================================================
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'client',
  logo_url text,
  brand_primary text DEFAULT '#0B2545',
  brand_secondary text DEFAULT '#C9A227',
  welcome_copy text,
  custom_domain text,
  powered_by_boost_footer boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
GRANT SELECT ON public.tenants TO anon;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tenants_set_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'learner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.tenant_members WHERE tenant_id = _tenant_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_tenant_id uuid, _user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.tenant_members WHERE tenant_id = _tenant_id AND user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','admin'))
$$;

REVOKE EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_tenant_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

CREATE POLICY "tenants_public_read_landing" ON public.tenants FOR SELECT TO anon USING (true);
CREATE POLICY "tenants_member_read" ON public.tenants FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_tenant_member(id, auth.uid()));
CREATE POLICY "tenants_super_admin_write" ON public.tenants FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "tenants_admin_update" ON public.tenants FOR UPDATE TO authenticated
  USING (public.has_tenant_role(id, auth.uid(), 'tenant_admin'))
  WITH CHECK (public.has_tenant_role(id, auth.uid(), 'tenant_admin'));

CREATE POLICY "tm_self_read" ON public.tenant_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));
CREATE POLICY "tm_admin_write" ON public.tenant_members FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));

-- =========================================================================
CREATE TABLE public.instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  bio text,
  credentials text,
  photo_url text,
  certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructors TO authenticated;
GRANT ALL ON public.instructors TO service_role;
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER instructors_set_updated_at BEFORE UPDATE ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "instructors_read" ON public.instructors FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "instructors_write" ON public.instructors FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));

-- =========================================================================
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  audience text,
  contact_hours numeric(6,2) DEFAULT 0,
  ceu_value numeric(6,2) DEFAULT 0,
  delivery_modes text[] NOT NULL DEFAULT '{self_paced}',
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'draft',
  dependency_mode text NOT NULL DEFAULT 'open',
  requires_needs_assessment boolean NOT NULL DEFAULT true,
  instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_image_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER courses_set_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "courses_read" ON public.courses FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "courses_write" ON public.courses FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
         OR public.has_tenant_role(tenant_id, auth.uid(), 'instructor'))
  WITH CHECK (public.is_super_admin(auth.uid())
              OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
              OR public.has_tenant_role(tenant_id, auth.uid(), 'instructor'));

CREATE TABLE public.course_needs_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_needs_assessments TO authenticated;
GRANT ALL ON public.course_needs_assessments TO service_role;
ALTER TABLE public.course_needs_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cna_read" ON public.course_needs_assessments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid()) OR public.is_tenant_member(c.tenant_id, auth.uid()))));
CREATE POLICY "cna_write" ON public.course_needs_assessments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (true);

CREATE TABLE public.learning_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  text text NOT NULL,
  bloom_verb text,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_objectives TO authenticated;
GRANT ALL ON public.learning_objectives TO service_role;
ALTER TABLE public.learning_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lo_read" ON public.learning_objectives FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid()) OR public.is_tenant_member(c.tenant_id, auth.uid()))));
CREATE POLICY "lo_write" ON public.learning_objectives FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (true);

CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_read" ON public.modules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid()) OR public.is_tenant_member(c.tenant_id, auth.uid()))));
CREATE POLICY "modules_write" ON public.modules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (true);

CREATE TABLE public.module_prerequisites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  required_module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  min_quiz_score numeric(5,2),
  UNIQUE (module_id, required_module_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_prerequisites TO authenticated;
GRANT ALL ON public.module_prerequisites TO service_role;
ALTER TABLE public.module_prerequisites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_read" ON public.module_prerequisites FOR SELECT TO authenticated USING (true);
CREATE POLICY "mp_write" ON public.module_prerequisites FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.modules m JOIN public.courses c ON c.id = m.course_id
                 WHERE m.id = module_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (true);

CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_minutes integer DEFAULT 0,
  objective_ids uuid[] DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons_read" ON public.lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.modules m JOIN public.courses c ON c.id = m.course_id
                 WHERE m.id = module_id
                 AND (public.is_super_admin(auth.uid()) OR public.is_tenant_member(c.tenant_id, auth.uid()))));
CREATE POLICY "lessons_write" ON public.lessons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.modules m JOIN public.courses c ON c.id = m.course_id
                 WHERE m.id = module_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (true);

CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  pass_threshold numeric(5,2) NOT NULL DEFAULT 70,
  time_limit_minutes integer,
  objective_ids uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assess_read" ON public.assessments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid()) OR public.is_tenant_member(c.tenant_id, auth.uid()))));
CREATE POLICY "assess_write" ON public.assessments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (true);

CREATE TABLE public.assessment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'mcq',
  stem text NOT NULL,
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct jsonb,
  rationale text,
  objective_id uuid REFERENCES public.learning_objectives(id) ON DELETE SET NULL,
  legacy_question_id uuid,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_items TO authenticated;
GRANT ALL ON public.assessment_items TO service_role;
ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_read" ON public.assessment_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessments a JOIN public.courses c ON c.id = a.course_id
                 WHERE a.id = assessment_id
                 AND (public.is_super_admin(auth.uid()) OR public.is_tenant_member(c.tenant_id, auth.uid()))));
CREATE POLICY "ai_write" ON public.assessment_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessments a JOIN public.courses c ON c.id = a.course_id
                 WHERE a.id = assessment_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (true);

CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO authenticated;
GRANT ALL ON public.surveys TO service_role;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "surveys_read" ON public.surveys FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid()) OR public.is_tenant_member(c.tenant_id, auth.uid()))));
CREATE POLICY "surveys_write" ON public.surveys FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (true);

CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  funding_source text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  ceu_awarded numeric(6,2) DEFAULT 0,
  certifier_credential_id text,
  certifier_verify_url text,
  certifier_badge_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER enroll_set_updated_at BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "enroll_read" ON public.enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
         OR public.has_tenant_role(tenant_id, auth.uid(), 'instructor'));
CREATE POLICY "enroll_insert" ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid())
              OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));
CREATE POLICY "enroll_update" ON public.enrollments FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
         OR user_id = auth.uid())
  WITH CHECK (true);

CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_responses TO authenticated;
GRANT ALL ON public.survey_responses TO service_role;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_self" ON public.survey_responses FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE TABLE public.work_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  template jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_products TO authenticated;
GRANT ALL ON public.work_products TO service_role;
ALTER TABLE public.work_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wp_read" ON public.work_products FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid()) OR public.is_tenant_member(c.tenant_id, auth.uid()))));
CREATE POLICY "wp_write" ON public.work_products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (true);

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  prompt text,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  placement text NOT NULL DEFAULT 'module',
  module_ids uuid[] DEFAULT '{}',
  work_product_ids uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "act_read" ON public.activities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid()) OR public.is_tenant_member(c.tenant_id, auth.uid()))));
CREATE POLICY "act_write" ON public.activities FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (true);

CREATE TABLE public.activity_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_output jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_responses TO authenticated;
GRANT ALL ON public.activity_responses TO service_role;
ALTER TABLE public.activity_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ar_self" ON public.activity_responses FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE TABLE public.student_vault_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  source_id uuid,
  file_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_vault_items TO authenticated;
GRANT ALL ON public.student_vault_items TO service_role;
ALTER TABLE public.student_vault_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svi_self" ON public.student_vault_items FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE TABLE public.progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress',
  completed_at timestamptz,
  score numeric(6,2),
  attendance_seconds integer DEFAULT 0,
  UNIQUE (enrollment_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress TO authenticated;
GRANT ALL ON public.progress TO service_role;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_self" ON public.progress FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id
                 AND (e.user_id = auth.uid() OR public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(e.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(e.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (true);

CREATE TABLE public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  zoom_meeting_id text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  recording_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_sessions TO authenticated;
GRANT ALL ON public.live_sessions TO service_role;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ls_read" ON public.live_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "ls_admin" ON public.live_sessions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.live_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  joined_at timestamptz,
  left_at timestamptz,
  duration_seconds integer DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_attendance TO authenticated;
GRANT ALL ON public.live_attendance TO service_role;
ALTER TABLE public.live_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "la_self" ON public.live_attendance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id
                 AND (e.user_id = auth.uid() OR public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(e.tenant_id, auth.uid(), 'tenant_admin'))))
  WITH CHECK (true);

CREATE TABLE public.external_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text NOT NULL,
  title text NOT NULL,
  deep_link_token text,
  ceu_value numeric(6,2) DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_courses TO authenticated;
GRANT ALL ON public.external_courses TO service_role;
ALTER TABLE public.external_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ec_read" ON public.external_courses FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "ec_admin" ON public.external_courses FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
  WITH CHECK (true);

CREATE TABLE public.ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL,
  model text,
  input jsonb,
  output jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generations TO authenticated;
GRANT ALL ON public.ai_generations TO service_role;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aig_admin" ON public.ai_generations FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())
         OR (tenant_id IS NOT NULL AND public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')))
  WITH CHECK (true);

CREATE TABLE public.integration_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  credentials_ref text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_accounts TO authenticated;
GRANT ALL ON public.integration_accounts TO service_role;
ALTER TABLE public.integration_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_admin" ON public.integration_accounts FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));

CREATE TABLE public.webhooks_outbound (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhooks_outbound TO authenticated;
GRANT ALL ON public.webhooks_outbound TO service_role;
ALTER TABLE public.webhooks_outbound ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wo_admin" ON public.webhooks_outbound FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.webhooks_outbound(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  delivered_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wd_admin" ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.webhooks_outbound w WHERE w.id = webhook_id
                 AND (public.is_super_admin(auth.uid()) OR public.has_tenant_role(w.tenant_id, auth.uid(), 'tenant_admin'))));

-- =========================================================================
-- LEGACY LCSW TABLES — tag with tenant
-- =========================================================================
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.review_queue ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- =========================================================================
-- SEED TENANTS
-- =========================================================================
INSERT INTO public.tenants (slug, name, kind, brand_primary, brand_secondary, welcome_copy, powered_by_boost_footer)
VALUES
  ('boost', 'Boost Strategy Group', 'root', '#0B2545', '#C9A227',
   'Welcome to Boost — building leaders, businesses, and communities.', false),
  ('apprenticeship', 'BOOST Apprenticeship Program', 'apprenticeship', '#0B2545', '#C9A227',
   'Apprenticeship learning pathway — LCSW exam prep and beyond.', true),
  ('client-one', 'Client One', 'client', '#0B2545', '#C9A227',
   'Welcome to your team learning portal.', true),
  ('client-two', 'Client Two', 'client', '#0B2545', '#C9A227',
   'Welcome to your team learning portal.', true),
  ('client-three', 'Client Three', 'client', '#0B2545', '#C9A227',
   'Welcome to your team learning portal.', true)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.questions SET tenant_id = (SELECT id FROM public.tenants WHERE slug='apprenticeship') WHERE tenant_id IS NULL;
UPDATE public.study_sessions SET tenant_id = (SELECT id FROM public.tenants WHERE slug='apprenticeship') WHERE tenant_id IS NULL;
UPDATE public.review_queue SET tenant_id = (SELECT id FROM public.tenants WHERE slug='apprenticeship') WHERE tenant_id IS NULL;
