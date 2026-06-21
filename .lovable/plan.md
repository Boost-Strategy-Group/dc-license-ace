
# BOOST Learning & Credentialing Platform — Revised Plan (v2)

Scope: **MVP + AI Course Factory**, multi-tenant, white-label client portals, fully embedded experience. Reflects clarifications: Certifier integration (not in-house certs), pre/post as ungraded surveys, flexible work-product activities, module dependency modes, IACET structural compliance, BFOS deferred to your content load.

## What's in scope

1. **Multi-tenant foundation** — Boost root, Apprenticeship tenant (LCSW lives here), and 3 paying-client tenants. Per-tenant branding: logo, brand color, custom welcome copy, "Powered by Boost" footer toggle. Optional custom subdomain later.
2. **Roles** — super_admin, tenant_admin, instructor, learner, mentor (apprenticeship stub).
3. **AI Needs Assessment Generator** (precedes Factory) — guided intake → AI research → Needs Assessment, Industry Analysis, Learning Gap Analysis, citations. Stored as a permanent artifact on the course (IACET requirement).
4. **AI Course Factory** — consumes the Needs Assessment + admin inputs → drafts Course Description, IACET-aligned Learning Objectives (Bloom verbs), Module Outline, Lessons, Instructor Guide, Slide Outline, Quizzes, Activities, Final Exam. Each artifact editable and versioned.
5. **Course Builder** (the editor/canvas) — where Factory drafts land and where from-scratch courses are built. Drag-reorder modules/lessons, add video/text/file/quiz/activity/exam/HeyGen/Zoom lessons, attach downloads, configure sequencing.
   - **Module dependency modes per course:** Open access · Sequential · Custom prerequisites.
   - **Publish gate:** course can't publish without Needs Assessment, Learning Objectives, Activities tied to objectives, Assessments tied to objectives, Instructor bio + credentials, Pre/Post survey configured, Contact-hour value set.
6. **Three delivery modes per course** — Self-paced · Hybrid · Live ILT (no rebuild).
7. **Assessments (graded)** — Module quizzes, Final exam. Auto-grade MCQ/T-F/multi-select; manual-grade short answer; pass thresholds; per-objective tagging for IACET alignment reports.
8. **Surveys (ungraded)** — **Pre-course survey** and **Post-course survey + evaluation**. Likert, multi-select, short answer, NPS. No grade. Stored for pre/post delta reporting and IACET evaluation requirement.
9. **Activity-based learning + AI Work Product Engine** — Activities can be placed pre-course (intake), in a single module, spanning multiple modules, or as a capstone. Each activity declares which **work product(s)** it feeds. Engine assembles deliverables (Business Plan, SOP, Capability Statement, etc.) into the Student Vault. BFOS multi-week pattern (intake activity → work product → weekly modules building on it) is supported natively; you load the content when ready.
10. **Embedded live sessions (Zoom Meeting SDK)** — Live/hybrid sessions render **inside** the course player. Attendance + duration captured via Zoom webhooks and posted to progress.
11. **Embedded HeyGen** — Server-side generation of instructor-avatar narrated video; rendered MP4/HLS stored and played in our native player. Learner never sees HeyGen.
12. **Embedded TalentLMS** — SSO + iframe wrapped in our chrome so external courses appear inside our catalog and player; completions sync back via API/webhook. (Trade-off: TalentLMS player UI shows inside the frame; we can theme/wrap but not fully replace it.)
13. **Embedded Stripe** — Stripe Elements / Embedded Checkout in-page for course/cert/subscription purchases. Webhook auto-enrolls on payment.
14. **Certifier integration (no in-house cert engine)** — On course/program completion, POST to Certifier API; store returned credential ID + verify URL + badge image on the enrollment. Badge shown in Student Vault. Learner social-share uses Certifier's native LinkedIn/etc. hand-off.
15. **CEU calculation + records** — contact-hours per module → CEUs (10 hrs = 1 CEU), stored on enrollment, displayed on certificate metadata sent to Certifier, exportable in reports. Permanent learner record retained for IACET.
16. **Instructor profiles** — bio, credentials, photo, certifications. Required before publishing a course.
17. **Client Portal (white-label)** — `/c/:tenantSlug` branded landing + learner area; Boost admin assigns courses to each client; client admin manages their own learners. "Powered by Boost" footer toggle per tenant.
18. **Funding source tagging** on enrollments — self-pay, grant, apprenticeship, ETPL, RTI, workforce board, corporate sponsor, client-sponsored.
19. **LCSW migration** — existing question bank, sessions, review_queue absorbed into the new course/assessment model as the first published course under the Apprenticeship tenant. No data loss.
20. **BBS integration** — signed outbound webhooks (enrollment.created, course.completed, credential.issued, ceu.awarded) + authenticated REST pull endpoint. Documented contract artifact for the BBS project.
21. **Employee Survey tool** — stubbed link-out + webhook receiver (separate Lovable project, wired later).
22. **Reporting** — enrollments, completions, CEUs awarded, certificates issued (from Certifier sync), revenue, per-tenant breakdown, pre/post survey deltas.
23. **Multilingual scaffold** — EN + ES keys wired (i18n provider, translatable course fields). Content translations deferred.

## Explicitly deferred

- BFOS content load (you'll add via Course Builder when ready)
- In-house certificate engine + `/verify/:code` page (Certifier owns this)
- Deep apprenticeship workflows (mentors, RTI logging, competency tracking) — tenant + role exist; flows later
- Full Workforce Development outcomes pipeline (employment outcomes etc.)
- IACET export endpoint (structural compliance built in, no export button)
- GHL, StreamYard (replaced by embedded Zoom + native catalog)
- Native mobile, Apple SSO, SAML
- Full Spanish translations of UI/courses

## Technical design

**Stack:** TanStack Start + Lovable Cloud + Lovable AI Gateway. Existing project extended (no rebuild).

**New schema (additive — current LCSW tables migrate, not dropped):**

- `tenants` (slug, name, logo_url, brand_primary, brand_secondary, custom_domain, powered_by_boost_footer, settings)
- `tenant_members` (tenant_id, user_id, role)
- `instructors` (tenant_id, user_id, bio, credentials, photo_url, certifications jsonb)
- `courses` (tenant_id, title, slug, description, audience, contact_hours, ceu_value, delivery_modes[], language, status, dependency_mode: open|sequential|custom, requires_needs_assessment, instructor_id, branding overrides)
- `course_needs_assessments` (course_id, inputs jsonb, output jsonb, citations jsonb, generated_by, version) — IACET artifact
- `learning_objectives` (course_id, text, bloom_verb, order)
- `modules` (course_id, order, title, summary)
- `module_prerequisites` (module_id, required_module_id, min_quiz_score)
- `lessons` (module_id, order, type: video|text|file|quiz|activity|exam|heygen|zoom_live|talentlms, content jsonb, duration_minutes, objective_ids[])
- `assessments` (parent: course|module, kind: quiz|final_exam, pass_threshold, time_limit, objective_ids[])
- `assessment_items` (assessment_id, type, stem, choices, correct, rationale, objective_id) — LCSW questions migrate here
- `surveys` (course_id, kind: pre|post, schema jsonb) — ungraded
- `survey_responses` (survey_id, enrollment_id, responses jsonb, submitted_at)
- `activities` (course_id, title, prompt, schema jsonb, placement: pre_course|module|cross_module|capstone, module_ids[], work_product_ids[])
- `activity_responses` (activity_id, enrollment_id, response jsonb, ai_output jsonb)
- `work_products` (course_id, kind, title, template jsonb)
- `student_vault_items` (user_id, kind: work_product|badge|report, title, source_id, file_url)
- `enrollments` (course_id, user_id, tenant_id, status, funding_source, started_at, completed_at, ceu_awarded, certifier_credential_id, certifier_verify_url)
- `progress` (enrollment_id, lesson_id, status, completed_at, score, attendance_seconds)
- `live_sessions` (lesson_id, zoom_meeting_id, start_at, recording_url)
- `live_attendance` (live_session_id, enrollment_id, joined_at, left_at, duration_seconds)
- `external_courses` (tenant_id, provider: talentlms, external_id, deep_link_token, ceu_value)
- `ai_generations` (kind, input, output, model, course_id, user_id)
- `integration_accounts` (tenant_id, provider: stripe|heygen|zoom|talentlms|certifier|survey, credentials_ref, settings)
- `webhooks_outbound` (tenant_id, target_url, secret, events[]) + `webhook_deliveries` (log)

RLS scoped by tenant membership + `has_role`. Service role for verified webhooks/admin only.

**Server functions** (`createServerFn` + `requireSupabaseAuth`):
`ai/draft-needs-assessment`, `ai/draft-course`, `ai/draft-quiz`, `ai/assemble-work-product`, `courses/*`, `lessons/*`, `enrollments/*`, `zoom/create-meeting`, `zoom/signature`, `heygen/generate`, `talentlms/sync`, `certifier/issue`, `bbs/emit`.

**Public server routes** (`src/routes/api/public/*`) — HMAC-verified:
`stripe-webhook`, `zoom-webhook` (attendance), `talentlms-webhook` (completions), `certifier-webhook` (issuance confirm), `heygen-webhook` (render done), `survey-webhook`, `bbs-pull`.

**Secrets added per integration** (request via `add_secret` when each phase begins): `STRIPE_*` (or use Lovable's seamless Stripe), `HEYGEN_API_KEY`, `ZOOM_SDK_KEY`, `ZOOM_SDK_SECRET`, `ZOOM_WEBHOOK_SECRET`, `TALENTLMS_API_KEY`, `TALENTLMS_DOMAIN`, `CERTIFIER_API_KEY`, `BBS_WEBHOOK_SIGNING_SECRET`. `LOVABLE_API_KEY` already present.

**Routes (high-level):**

```text
/                              marketing
/auth                          sign-in
/c/:tenantSlug                 white-label client landing
/_authenticated/
  dashboard                    role-aware
  catalog                      courses available to me
  course/:id                   player: lessons, embedded Zoom, embedded TalentLMS, quizzes, surveys, activities
  vault                        work products + Certifier badges
  admin/
    tenants                    super_admin
    branding                   tenant_admin
    instructors
    courses                    builder (canvas)
    courses/:id/needs-assessment   AI wizard (step 1)
    courses/:id/ai-factory         AI wizard (step 2 — uses needs assessment)
    courses/:id/publish-check      IACET readiness checklist
    learners                   roster + invites + CSV
    enrollments
    integrations               stripe/heygen/zoom/talentlms/certifier/survey
    webhooks                   BBS + custom
    reports                    incl. pre/post survey deltas
```

## Build sequence

1. **Phase A — Foundation:** tenants, memberships, RLS refactor, LCSW migration into new model, white-label client landing, invite flow. Demo-ready for your 3 clients on a placeholder course.
2. **Phase B — Course Builder + Learner Player:** modules/lessons/quizzes/surveys/activities, dependency modes, progress, Student Vault, embedded Stripe checkout, IACET publish-gate checklist.
3. **Phase C — AI Needs Assessment → AI Course Factory → Work Product Engine** (Lovable AI Gateway).
4. **Phase D — Embedded integrations:** Zoom Meeting SDK (live sessions in-app + attendance), HeyGen narrated lessons, TalentLMS SSO+iframe wrapper, Certifier issuance + badge in Vault.
5. **Phase E — BBS bridge:** signed outbound webhooks, authenticated pull API, admin UI to register endpoint, contract doc for BBS project.
6. **Phase F — Reporting (incl. pre/post deltas, CEU report), Spanish scaffold, polish.**

Each phase is a demo-able slice; you can onboard the 3 paying clients after Phase B.

## What I need from you to start Phase A

- Names (and logos if handy) for the 3 client tenants — placeholders fine, swap later.
- Confirm Certifier API access is available on your account (I'll request `CERTIFIER_API_KEY` when Phase D starts).
- Confirm Zoom account tier supports the Meeting SDK (required for in-app embed; Pro+ in most cases).
