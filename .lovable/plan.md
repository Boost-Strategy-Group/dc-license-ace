# BoostMyWorkforce v3 — Phased Implementation Plan

Phase-by-phase. Each phase ships end-to-end before the next starts. Phases 1–2 are done; we resume at Phase 3.

---

## Phase 1 — Foundation (DONE)
- DB restructure: `boost_modules`, `tenant_boost_modules`, `course_publications`, `apprenticeship_programs`, `learners`, `rti_completions`, `employees`, state-training tables, `tenants` branding/domain columns.
- Seeded four modules: **Boost!Roles, Boost!Perform, Boost!Pulse, Boost!Learn**.
- Auth + landing rebrand to "BOOST Learning & Credentialing".
- Launchpad + ModuleTile reading per-tenant entitlements.
- Integration stubs: BBS Community Builder Pro, TalentLMS.

## Phase 2 — Tenant & Student Admin (DONE)
- Tenants list + create wizard with branding.
- Tenant detail: branding, members, invites, GoSprout panel.
- Per-tenant module entitlements (active / coming_soon / available).
- Student Management: pick tenant, enroll by email, toggle per-learner module access.
- Test-user quick login + auto-role-grant trigger for `jackie@boost.test`, `admin@boost.test`, `learner@boost.test`.

---

## Phase 3 — Module Shells (DONE)
Roles, Perform, Pulse, Learn shells + shared `/employees` directory shipped.

## Phase 5 — Publishing & Catalog (CURRENT)
SuperAdmin publish picker, `course_publications` writers, tenant-scoped course lists, BBS push via stub.

## Phase 4 — BOOST! Implementation Agent (DONE)
Animated assistant named **BOOST!** that takes clients through a per-module setup wizard, answers questions, and configures the system. Scope: **Roles, Perform, Pulse only.** Training and Apprenticeship questions are always routed to BSG support.

Behavior:
- Per-module setup wizards (Roles, Perform, Pulse): conversational, collects inputs, writes config to the DB.
- Uses AI to draft artifacts (job descriptions, goal/performance-plan structures, survey question sets) and stages them as **drafts** — never auto-published.
- For config requests → executes via server functions.
- For "change beyond config" requests → offers a workaround **or** opens a support ticket to BSG.
- For Learn/Apprenticeship requests → always routes to BSG support ticket.
- **Approval gate**: before any performance plan, engagement survey, or goal program goes live, BOOST! sends a verification email to the requesting admin with a one-click "Confirm & Publish" link. Approval, who approved, and timestamp are written to an audit log.
- Animated avatar (lottie or CSS) with idle / thinking / success / blocked states.

Pieces:
- `boost_agent_sessions`, `boost_agent_messages`, `boost_agent_actions`, `boost_agent_approvals` tables.
- AI SDK chat server route under `src/routes/api/boost-agent.ts` using Lovable AI (`google/gemini-3-flash-preview`).
- Tools: `propose_jd`, `propose_goal_plan`, `propose_survey`, `stage_publish`, `request_approval`, `open_support_ticket`.
- Approval email via Lovable Emails with magic-token confirm route.
- UI: floating BOOST! launcher on every module home; full-screen wizard mode for first-run setup.

## Phase 5 — Publishing & Catalog
SuperAdmin publish picker, `course_publications` writers, tenant-scoped course lists, BBS push via stub.

## Phase 6 — State Training Vertical
Eligibility screener, vouchers + Stripe copay, scheduler, authorizations queue.

## Phase 7 — Apprenticeship / RTI Reporting
Per-learner RTI dashboard, GoSprout CSV export + reminder, mentor view.

## Phase 8 — Polish & Public Marketing
- Marketing homepage: four-modules pitch.
- **Do NOT publish client logos or named client lists publicly.** Use generic industry/vertical descriptors only.
- SEO metadata per route, OG images.
- Empty states, loading skeletons, mobile pass.
- Publish.

---

## Out of Scope (defer)
- True SSO with GoSprout / TalentLMS.
- Multi-tenant switcher for users in >1 tenant.
- HeyGen avatar narration inside module pages.
- BOOST! agent for Learn or Apprenticeship modules (always BSG support).

---

**Next action:** Start Phase 3 (module shells) then Phase 4 (BOOST! agent) — both can begin in parallel since the agent UI hooks into the module shells.
