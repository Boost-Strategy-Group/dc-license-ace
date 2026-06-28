# BOOST! My WorkForce Suite — Developer Documentation

**Platform:** BOOST! My WorkForce Suite by Boost Strategy Group  
**Tagline:** Smart Tools. Stronger Teams. Better Results.  
**Repository:** dc-license-ace  
**Last Updated:** June 2026

---

## Document Index

All documentation for the Lovable development team is in this `/docs` folder.

| Document | Purpose | Use When |
|---|---|---|
| `BOOST_Developer_Transition_Package.docx` | Complete platform context, PRD, data model, roadmap, open decisions | Start here — full product understanding |
| `BOOST_Technical_Specification.docx` | DB schema (SQL), server functions, RLS policies, integrations, env vars | Building any feature |
| `BOOST_UI_Specification.docx` | Screen-by-screen layouts, v0 prompts for every screen | Building UI / generating mockups in v0 |
| `BOOST_Phased_Implementation_Plan.docx` | 13-week sprint plan: Learn → Pulse → Roles → Perform | Daily development guide |
| `BOOST_Brand_Color_Reference.docx` | Color palette, typography, Tailwind tokens, v0 brand prompt | All design work |
| `BOOST_ERD_Permissions_StateMachines.docx` | Entity relationships, permission matrix, state diagrams | Data model & workflow questions *(coming soon)* |
| `BOOST_Component_Library_Design_System.docx` | Every reusable component specified | Building consistent UI *(coming soon)* |
| `BOOST_Notifications_AcceptanceCriteria.docx` | Notification matrix + Given/When/Then acceptance criteria | QA & testing *(coming soon)* |

---

## Quick Start for Lovable Developers

1. Read `BOOST_Developer_Transition_Package.docx` sections 1–2 (Executive Vision, Product Overview)
2. Set all environment variables (Section 9 of Technical Spec)
3. Run the Day 1 foundation tasks (Section 2 of Implementation Plan)
4. Begin Phase 1 — Boost!Learn (Section 3 of Implementation Plan)

## Stack
- TanStack Start (React 19, SSR), TanStack Router (file-based), TanStack Query
- TypeScript 5.8, Tailwind CSS v4, Radix UI + shadcn/ui
- Supabase (Postgres + Auth + RLS), project ID: `pwcexdecqygnxmxipfbt`
- Lovable AI Gateway → Gemini 2.5 Flash / Gemini 3 Flash Preview
- Stripe, Certifiably API, TalentLMS REST API
- Bun package manager, Vite 8

## Module Build Order
1. **Boost!Learn** (Weeks 1–3) — LMS, course player, Certifiably, TalentLMS
2. **Boost!Pulse** (Weeks 4–6) — Surveys, results, AI action plans
3. **Boost!Roles** (Weeks 7–9) — Job descriptions, org chart, employee import
4. **Boost!Perform** (Weeks 10–13) — Goals, review cycles, 360 feedback

## Key Contacts
- **Jackie Taylor** — Founder/CEO, Super Admin, product owner (all open decisions route to Jackie)
- **BSG Development Team** — Module-scoped platform admins

---

*BOOST! My WorkForce Suite | Boost Strategy Group | CONFIDENTIAL*
