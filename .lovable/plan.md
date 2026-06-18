# Boost Strategy Group — LCSW Credential Readiness Tool

A Washington DC apprenticeship prep app for the ASWB Clinical exam. Boost admins manage students and the question bank; apprentices study, take a full mock, and see a readiness score.

## On the question bank (important context first)

There is **no free, licensable ASWB question API** on the market — ASWB protects retired items, and every commercial bank (SWES ~700 Qs, Health Exams 940 Qs, LCSW Booster, TDC, Pocket Prep, Springer/ExamPrepConnect) is sold as an end-user subscription, not as data. So we cannot legally pipe a third-party bank into this app.

What we'll do instead:
1. **Build a first-class internal bank** mapped to the official 2026 ASWB Clinical blueprint (the 4 content areas).
2. **Seed it** with a starter set of original, blueprint-aligned items written by the AI (clearly labeled "AI-drafted — admin reviewed").
3. **Admin authoring + bulk CSV import** so Boost staff and SMEs can grow the bank quickly.
4. **AI-assisted drafting** inside the admin: pick a category + sub-topic → generate a draft question → admin edits/approves before it goes live.
5. Include a Settings note + link-out so students who want extra reps can buy a commercial bank (SWES, LCSW Booster, Pocket Prep) — we don't redistribute their content.

If you have an existing SME-written bank (Word/Excel/PDF), we'll import it via the CSV tool on day 1.

## Scope

**Roles**
- **Admin** (Boost staff): manage students, manage question bank (CRUD + CSV import + AI draft), view cohort & per-student analytics.
- **Student** (DC apprentice): study by category, timed mock, flashcards/spaced review of missed items, personal readiness dashboard.

**Exam model — ASWB Clinical, 4 content areas**
1. Human Development, Diversity, and Behavior in the Environment
2. Assessment and Diagnosis
3. Psychotherapy, Clinical Interventions, and Case Management
4. Professional Values and Ethics

Each question is tagged with one content area (+ optional free-text sub-topic, e.g. "DSM-5 mood disorders", "confidentiality"), difficulty, rationale, and source.

**Student study modes**
- **Practice by category** — choose area, answer 10/25/50 Qs, instant feedback + rationale.
- **Timed full-length mock** — 170 questions, 4-hour timer, ASWB content-area mix, score report at the end.
- **Flashcards / spaced review** — every missed question goes into a per-student review queue on a simple SM-2 spaced interval.
- **Readiness dashboard** — overall readiness %, per-content-area accuracy, weak-area flags, last 5 sessions, mock history.

**Admin tools**
- Student roster: add (email invite), deactivate, view individual progress.
- Question bank: list/filter/search by area, create/edit/delete, CSV import, AI-draft modal.
- Cohort analytics: average readiness, hardest questions, area-level accuracy across all students.

## Visual direction

Professional, calm, study-focused — not consumer-flashy. Boost Strategy Group branding: deep navy primary, warm gold accent, generous whitespace, serif display headings (Fraunces) + clean sans body (Inter). Card-based dashboards, no purple gradients.

## Technical details

**Stack:** TanStack Start + Lovable Cloud (Supabase under the hood) + Lovable AI Gateway for question drafting.

**Auth:** Email/password + Google sign-in via Lovable Cloud. Role stored in `user_roles` table (`admin` | `student`) using the security-definer `has_role()` pattern — never on profiles.

**Schema (migrations):**
- `profiles` (id → auth.users, full_name, cohort, status)
- `app_role` enum + `user_roles`
- `questions` (id, content_area enum, sub_topic text, stem, choices jsonb[4], correct_index, rationale, difficulty, source, created_by, status: draft|published)
- `question_drafts` (AI-generated, pending admin review)
- `study_sessions` (student_id, mode, started_at, finished_at, score)
- `session_responses` (session_id, question_id, chosen_index, is_correct, ms_spent)
- `review_queue` (student_id, question_id, ease, interval_days, due_at) for spaced review
- RLS: students see only their own sessions/queue; admins see all; published questions readable by all authenticated users.

**Routes**
- `/auth` — sign in / sign up
- `/_authenticated/` — student dashboard (readiness, continue studying)
- `/_authenticated/practice` — pick category & length
- `/_authenticated/session/$id` — question runner (shared by practice + mock)
- `/_authenticated/mock` — start full-length mock
- `/_authenticated/review` — spaced flashcards
- `/_authenticated/_admin/students` — roster
- `/_authenticated/_admin/questions` — bank manager (list, edit, CSV import, AI draft)
- `/_authenticated/_admin/analytics` — cohort view

**Server functions** (`createServerFn` under `src/lib/*.functions.ts`):
- `startSession`, `submitAnswer`, `finishSession`
- `getReadiness` (per-student rollups)
- `adminListStudents`, `adminInviteStudent`, `adminCohortStats`
- `adminCreateQuestion`, `adminBulkImportCsv`, `adminAiDraftQuestion` (calls Lovable AI Gateway, returns draft, admin approves to publish)

**Seed:** migration inserts ~40 AI-drafted, admin-review-ready starter questions across all 4 content areas so the app is usable on day one.

## Build order

1. Enable Lovable Cloud, set up auth (email + Google), profiles, roles, RLS.
2. Schema migration for questions + sessions + review queue + seed data.
3. Admin question bank (CRUD + CSV import + AI draft modal).
4. Student practice-by-category flow + session runner.
5. Readiness dashboard.
6. Timed full mock.
7. Spaced review queue.
8. Admin analytics + student roster management.
9. Design polish, empty states, SEO/meta per route.

## Out of scope (call out now)

- Importing copyrighted third-party banks (SWES, Pocket Prep, LCSW Booster, etc.).
- Payments / subscriptions.
- Other ASWB levels (Bachelors, Masters) or other states' jurisprudence exams — easy to add later; the schema supports it.
- Mobile native apps (the web app is fully responsive).
