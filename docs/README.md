# BOOST! My WorkForce Suite — Developer Documentation

**Platform:** BOOST! My WorkForce Suite by Boost Strategy Group  
**Tagline:** Smart Tools. Stronger Teams. Better Results.  
**Repository:** dc-license-ace  
**Last Updated:** June 2026

---

## Document Index

All documentation for the Lovable development team is in this `/docs` folder.

| # | Document | Pages | Purpose | Start Here? |
|---|---|---|---|---|
| 1 | `BOOST_Developer_Transition_Package.docx` | 48 | Full PRD, data model, open decisions, roadmap | ✅ Yes — read first |
| 2 | `BOOST_Technical_Specification.docx` | 32 | DB schema (SQL), server functions, RLS, integrations, env vars | ✅ Required for all development |
| 3 | `BOOST_UI_Specification.docx` | 45 | Screen-by-screen layouts + paste-ready v0 prompts | When building UI |
| 4 | `BOOST_Phased_Implementation_Plan.docx` | 16 | 13-week sprint plan: Learn → Pulse → Roles → Perform | Daily dev guide |
| 5 | `BOOST_ERD_Permissions_StateMachines.docx` | 27 | Entity relationships, permission matrix, workflow state diagrams | Data model questions |
| 6 | `BOOST_Component_Library_Design_System.docx` | 27 | Every reusable component specified with Tailwind + shadcn/ui | Building consistent UI |
| 7 | `BOOST_Notifications_AcceptanceCriteria.docx` | 11 | Notification matrix (40+ triggers) + Given/When/Then acceptance criteria | QA & testing |
| 8 | `BOOST_Brand_Color_Reference.docx` | 2 | Color palette, Tailwind tokens, v0 brand context prompt | All design work |

**Total: 208 pages of developer documentation**

---

## Quick Start for Lovable Developers

### Day 1 — Before any feature work
1. Read `BOOST_Developer_Transition_Package.docx` Sections 1–2 (Executive Vision + Product Overview)
2. Read `BOOST_Technical_Specification.docx` Section 9 (Environment Variables) — set all secrets
3. Run `bun install` → `bun run dev` → confirm app starts
4. Complete all Day 1 Foundation Tasks in `BOOST_Phased_Implementation_Plan.docx` Section 2

### Then follow the sprint plan
- **Weeks 1–3:** Boost!Learn (Section 3 of Implementation Plan)
- **Weeks 4–6:** Boost!Pulse (Section 4)
- **Weeks 7–9:** Boost!Roles (Section 5)
- **Weeks 10–13:** Boost!Perform (Section 6)

---

## Stack
- **Framework:** TanStack Start (React 19, SSR), TanStack Router (file-based), TanStack Query
- **Language:** TypeScript 5.8
- **Styling:** Tailwind CSS v4, Radix UI + shadcn/ui
- **Database:** Supabase (Postgres + Auth + RLS), project ID: `pwcexdecqygnxmxipfbt`
- **AI:** Lovable AI Gateway → Gemini 2.5 Flash / Gemini 3 Flash Preview (Vercel AI SDK v6)
- **Payments:** Stripe (embedded checkout + webhooks)
- **Credentials:** Certifiably API (certificates + digital badges)
- **LMS Integration:** TalentLMS REST API
- **Build:** Bun, Vite 8

## Module Build Order
1. **Boost!Learn** — LMS, course player, Certifiably certificates, TalentLMS sync
2. **Boost!Pulse** — Surveys, engagement scoring, AI action plans
3. **Boost!Roles** — Job descriptions, org chart, employee import
4. **Boost!Perform** — Goals, review cycles, 360 feedback

## Key Contacts
- **Jackie Taylor** — Founder/CEO, Super Admin, product owner. All 13 open decisions in Transition Package Section 11.10 route to Jackie before implementation.
- **BSG Staff** — Module-scoped platform admins (see Technical Spec Section 7 for BSG Admin role setup)

## Critical Rules for Developers
- **Never rebase or force-push** — Lovable has published commits in git history. Merge commits only.
- **Never auto-publish AI content** — all AI-generated artifacts are always saved as draft first
- **Approval gates required** — performance plans, pulse surveys, and action plans need email confirmation before going live
- **RLS is enforced** — test cross-user data isolation for every new table
- **routeTree.gen.ts is auto-generated** — never edit manually

---

*BOOST! My WorkForce Suite | Boost Strategy Group | CONFIDENTIAL*
