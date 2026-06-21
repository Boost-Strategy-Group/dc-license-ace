
-- Tighten WITH CHECK on every child-table write policy to match its USING clause.

DROP POLICY IF EXISTS "cna_write" ON public.course_needs_assessments;
CREATE POLICY "cna_write" ON public.course_needs_assessments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))));

DROP POLICY IF EXISTS "lo_write" ON public.learning_objectives;
CREATE POLICY "lo_write" ON public.learning_objectives FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))));

DROP POLICY IF EXISTS "modules_write" ON public.modules;
CREATE POLICY "modules_write" ON public.modules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))));

DROP POLICY IF EXISTS "mp_write" ON public.module_prerequisites;
CREATE POLICY "mp_write" ON public.module_prerequisites FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.modules m JOIN public.courses c ON c.id = m.course_id
                 WHERE m.id = module_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.modules m JOIN public.courses c ON c.id = m.course_id
                 WHERE m.id = module_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))));

DROP POLICY IF EXISTS "lessons_write" ON public.lessons;
CREATE POLICY "lessons_write" ON public.lessons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.modules m JOIN public.courses c ON c.id = m.course_id
                 WHERE m.id = module_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.modules m JOIN public.courses c ON c.id = m.course_id
                 WHERE m.id = module_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))));

DROP POLICY IF EXISTS "assess_write" ON public.assessments;
CREATE POLICY "assess_write" ON public.assessments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))));

DROP POLICY IF EXISTS "ai_write" ON public.assessment_items;
CREATE POLICY "ai_write" ON public.assessment_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessments a JOIN public.courses c ON c.id = a.course_id
                 WHERE a.id = assessment_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assessments a JOIN public.courses c ON c.id = a.course_id
                 WHERE a.id = assessment_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))));

DROP POLICY IF EXISTS "surveys_write" ON public.surveys;
CREATE POLICY "surveys_write" ON public.surveys FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))));

DROP POLICY IF EXISTS "enroll_update" ON public.enrollments;
CREATE POLICY "enroll_update" ON public.enrollments FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())
         OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
         OR user_id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid())
              OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')
              OR user_id = auth.uid());

DROP POLICY IF EXISTS "wp_write" ON public.work_products;
CREATE POLICY "wp_write" ON public.work_products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))));

DROP POLICY IF EXISTS "act_write" ON public.activities;
CREATE POLICY "act_write" ON public.activities FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
                 AND (public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(c.tenant_id, auth.uid(), 'instructor'))));

DROP POLICY IF EXISTS "progress_self" ON public.progress;
CREATE POLICY "progress_self" ON public.progress FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id
                 AND (e.user_id = auth.uid() OR public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(e.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(e.tenant_id, auth.uid(), 'instructor'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id
                 AND (e.user_id = auth.uid() OR public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(e.tenant_id, auth.uid(), 'tenant_admin')
                      OR public.has_tenant_role(e.tenant_id, auth.uid(), 'instructor'))));

DROP POLICY IF EXISTS "la_self" ON public.live_attendance;
CREATE POLICY "la_self" ON public.live_attendance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id
                 AND (e.user_id = auth.uid() OR public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(e.tenant_id, auth.uid(), 'tenant_admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id
                 AND (e.user_id = auth.uid() OR public.is_super_admin(auth.uid())
                      OR public.has_tenant_role(e.tenant_id, auth.uid(), 'tenant_admin'))));

DROP POLICY IF EXISTS "ec_admin" ON public.external_courses;
CREATE POLICY "ec_admin" ON public.external_courses FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin'));

DROP POLICY IF EXISTS "aig_admin" ON public.ai_generations;
CREATE POLICY "aig_admin" ON public.ai_generations FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())
         OR (tenant_id IS NOT NULL AND public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')))
  WITH CHECK (public.is_super_admin(auth.uid())
              OR (tenant_id IS NOT NULL AND public.has_tenant_role(tenant_id, auth.uid(), 'tenant_admin')));
