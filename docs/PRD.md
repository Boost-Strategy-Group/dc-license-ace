# BOOST Learning & Credentialing Platform — Product Requirements Document (PRD)

**Version:** 1.0
**Owner:** Jackie P. Taylor, Boost Strategy Group
**Derived from:** `docs/BFRD.md` v1.0 + current implementation state
**Last updated:** 2026-06-27

---

## 1. Overview

BOOST is an all-in-one workforce hub for small and mid-sized businesses, workforce boards, apprenticeship sponsors, and state-training programs. It combines four operating modules (Roles, Perform, Pulse, Learn) with an AI implementation agent, multi-tenant administration, and verticals for apprenticeship/RTI reporting and state-funded training.

The product strategy is to deliver one platform that a tenant admin can stand up in minutes, that BSG can centrally publish content into, and that an end learner experiences as a focused launchpad rather than a generic LMS.

## 2. Problem & Goals

Small employers juggle disconnected tools for job descriptions, performance, engagement, and training. Workforce sponsors need defensible reporting (RTI hours, completions, vouchers). BSG needs to author once and distribute everywhere.

**Success metrics** (from BFRD §28):
- Course / certification completion rates
- CEUs awarded
- Learner satisfaction
- Employment outcomes
- Tenant growth and platform revenue

## 3. Personas & Roles

Mapped to the current `app_role` enum (`user_roles` table, server-checked via `has_role`):

| Persona | Role | Surface |
|---|---|---|
| BSG super admin | `super_admin` | `/admin/*`, publications, tenant CRUD, agent oversight |
| Client / tenant admin | `tenant_admin` | `/admin/student-management`, module entitlements, employees, approvals |
| Learner / employee | `learner` | `/app` launchpad, assigned modules, RTI hours, training |
| Mentor / instructor (future) | extend enum | RTI sign-off, live sessions |

Test accounts (handled by `handle_new_user` trigger): `jackie@boost.test`, `bsg-admin@boost.test`, `admin@boost.test`, `learner@boost.test` — password `B00st-Launch!2026$`.

## 4. Scope — Modules

### Boost!Roles — *Implemented*
Job descriptions and org chart per tenant. Learners see read-only "My job description"; tenant admins can create/edit; BOOST! agent can draft.

### Boost!Perform — *Implemented*
Goal setting, check-ins, approval requests with emailed magic-link confirmation. Audit trail of approver + timestamp.

### Boost!Pulse — *Implemented*
Engagement cadences and pulse surveys. Go-live for new survey programs requires email-confirmed admin approval.

### Boost!Learn — *Implemented*
Tenant-scoped catalog. Courses are either tenant-owned or centrally published via `course_publications`. AI Course Factory generates a draft plan → admin review/edit/regenerate → commit to course builder. GoSprout SSO launchpad available for apprentices.

### Apprenticeship / RTI — *Implemented*
`apprenticeship_programs`, `learners`, `rti_completions`. Admins can manage programs, view roster progress, and export a GoSprout-compatible CSV. Learners track their own RTI hours.

### State Training Vertical — *Implemented*
Eligibility screener, voucher issuance/redemption, appointment scheduling, state authorization records.

### BOOST! Implementation Agent — *Implemented* (Roles, Perform, Pulse only)
Animated chat agent powered by Lovable AI Gateway with tools to draft JDs, goals, and cadences. Creates approval requests instead of taking destructive actions directly. Hidden from learners. **Learn and Apprenticeship changes always route to a BSG support ticket — never executed by the agent.**

## 5. Out of Scope (v1)

- AI agent autonomy for Learn and Apprenticeship
- Public listing of named clients / client logos (generic industry descriptors only)
- Full bi-directional GoSprout data sync (current scope is SSO launchpad + manual completion summary)
- HeyGen avatars / voice clones
- Spanish localization (architecture ready; content not translated)
- Stripe billing, GHL, Zoom, StreamYard, Certifier integrations
- Live instructor-led delivery and attendance tracking

## 6. Functional Requirements (current vs. planned)

| Area | Current | Planned next |
|---|---|---|
| Tenant CRUD + branding | logo, color, domain, type | per-tenant subdomain auth |
| Entitlements | `tenant_boost_modules`, `tenant_member_modules` | bulk roster import |
| AI Course Factory | draft → review → commit | citations + IACET needs-assessment artifact |
| Publications | super-admin picker → tenant list | scheduled publish, unpublish audit |
| RTI export | GoSprout CSV | direct GoSprout API once partner access granted |
| State vertical | screening/vouchers/appointments | ETPL reporting export |
| Email | `notify.boostmyworkforce.com` transactional | digest emails, unsubscribe center |
| BOOST! agent | tool-calling, approval gating | voice mode, multilingual |

## 7. Non-Functional Requirements

- **Tenant isolation:** RLS on every public table; `has_role` security-definer for role checks; service-role only inside verified server functions.
- **Auditability:** every go-live for performance plans, goal programs, or engagement surveys requires an email-confirmed approval recorded with approver + timestamp.
- **Email infra:** sending domain `notify.boostmyworkforce.com`; unsubscribe and magic-link approval routes public.
- **Accessibility:** semantic HTML, keyboard reachable, dark/light theme via design tokens.
- **SEO:** marketing routes have unique titles, meta descriptions, OG images; `robots.txt` + `sitemap.xml` shipped.

## 8. Integrations

**Live:** Lovable Cloud (Supabase), Lovable AI Gateway (chat, future image/STT), transactional email via Resend on `notify.boostmyworkforce.com`.

**Stubs in repo:** BBS (`src/lib/integrations/bbs.ts`), GoSprout (`src/lib/integrations/gosprout.ts`), TalentLMS (`src/lib/integrations/talentlms.ts`).

**Deferred:** HeyGen, Stripe, GHL, Zoom, StreamYard, Certifier.

## 9. Milestones

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation, auth, tenants | ✅ |
| 2 | Tenant + student admin | ✅ |
| 3 | Module shells (Roles/Perform/Pulse) | ✅ |
| 4 | BOOST! Implementation Agent | ✅ |
| 5 | Publishing & Catalog | ✅ |
| 6 | State Training vertical | ✅ |
| 7 | Apprenticeship / RTI (private — no public client logos) | ✅ |
| 8 | Marketing polish, SEO | ✅ |
| 9 | Billing (Stripe), pricing pages | 🔜 |
| 10 | HeyGen avatars, ES localization | 🔜 |
| 11 | BBS deep-link + shared identity | 🔜 |
| 12 | GoSprout direct API once partner access secured | 🔜 |

## 10. Acceptance Criteria (samples)

- **Roles:** A learner navigating to `/modules/roles` sees only their own JD and no create/edit affordances or agent button.
- **Perform:** Creating a goal program triggers an approval email; the program does not go live until the magic link is clicked, and `approved_by` + `approved_at` are persisted.
- **Learn:** A course published by a super admin to Tenant A is visible in Tenant A's `/modules/learn` and not in Tenant B's.
- **RTI:** Admin can export a CSV whose columns match GoSprout's import spec; learners see hours within 1s of logging.
- **State:** A screener marking a participant ineligible blocks voucher issuance with an explanatory message.

## 11. Open Questions

1. Pricing & packaging — per-seat, per-module, or bundle? Needed before Phase 9.
2. Spanish launch timing and translation owner.
3. HeyGen budget and which personas get avatars first (Jackie AI vs. instructor AI).
4. GoSprout partner / API access timeline — gate for Phase 12.
5. BBS shared identity strategy — JWT exchange vs. OAuth.
