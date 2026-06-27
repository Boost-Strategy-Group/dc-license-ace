# Plan: Commit BFRD and Generate PRD

Create two committed documents in the repo so product context lives alongside code.

## 1. `docs/BFRD.md`
Verbatim copy of the BOOST Learning & Credentialing Platform Business Functional Requirements Document v1.0 from project knowledge (sections 1–29). No edits — this is the source-of-truth business document owned by Jackie / BSG.

## 2. `docs/PRD.md`
A true Product Requirements Document derived from the BFRD **and** the current implementation state of the app. Structured as:

- **Overview** — product vision, target users (BSG, tenant admins, learners, apprentices, state-training participants, BSG super admins).
- **Problem & Goals** — what BOOST solves, success metrics from BFRD §28.
- **Personas & Roles** — super_admin, tenant_admin, learner, mentor, instructor (mapped to current `user_roles` enum).
- **Scope — Modules**
  - Boost!Roles (job descriptions, org chart) — *implemented*
  - Boost!Perform (goals, approvals) — *implemented*
  - Boost!Pulse (cadences, check-ins) — *implemented*
  - Boost!Learn (catalog, AI Course Factory, publications) — *implemented, AI Factory has draft/review step*
  - Apprenticeship / RTI — *implemented, GoSprout CSV export*
  - State Training vertical — *implemented*
  - BOOST! Implementation Agent — *implemented (Roles/Perform/Pulse only)*
- **Out of Scope (v1)** — Learn/Apprenticeship for the AI agent; public client logos; full GoSprout data sync (SSO launchpad only); HeyGen avatars; multilingual ES; Stripe billing; Zoom/StreamYard live delivery; Certifier integration.
- **Functional Requirements** — per module, with current state vs. planned.
- **Non-Functional Requirements** — multi-tenant isolation (RLS), email infra on notify.boostmyworkforce.com, approval audit trail, accessibility.
- **Integrations** — Lovable Cloud (Supabase), Lovable AI Gateway, BBS (stub), GoSprout (SSO launchpad), TalentLMS (stub). Deferred: HeyGen, Stripe, GHL, Zoom, Certifier.
- **Milestones** — Phases 1–8 with status (1–8 complete) and follow-on phases (billing, HeyGen, ES localization, BBS deep link).
- **Acceptance Criteria** — sample per module.
- **Open Questions** — pricing model, ES launch timing, HeyGen budget, BBS API readiness.

## Notes
- No code or schema changes.
- Both files go in `docs/` (creating the folder).
- After approval I'll write the two files in one batch.
