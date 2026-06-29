# BOOST! My WorkForce Suite — Codebase Build Plan
**Owner:** Jackie Taylor, Founder/CEO, Boost Strategy Group  
**Last Updated:** June 28, 2026  
**Repo:** https://github.com/Boost-Strategy-Group/dc-license-ace  
**Branch convention:** feature work on branches, merge to `main`

---

## Scope Split

| Steps | Owner | Description |
|-------|-------|-------------|
| 1–6 | Perplexity Computer | Database, routing, modules, AI functions |
| 7–8 | Lovable developer | Integrations (OpenAI wiring, Stripe live, Rippling, Certifiably, TalentLMS) + Playwright CI |

---

## Tech Stack (Non-Negotiable)

- **Runtime:** TanStack Start on Cloudflare Workers
- **Database:** Supabase (Postgres + RLS) — project `pwcexdecqygnxmxipfbt`
- **Auth:** Supabase Auth — roles via `user_roles` + `tenant_members`
- **AI:** OpenAI SDK direct (`api.openai.com/v1`) — NOT Lovable gateway
- **Payments:** Stripe (existing `createStripeClient(env)` wrapper)
- **Build:** Vite + Bun
- **UI:** TanStack Router (dot-separated file routes), Radix UI, Tailwind v4
- **Fonts:** Fraunces (headings) + Inter (body) — already in package.json

---

## Lovable-Specific Constraints (Critical)

1. **No Supabase Edge Functions for app logic.** AI calls use `createServerFn` in `src/lib/*.functions.ts`. Edge functions only for external Supabase-network webhooks.
2. **Migration order:** `CREATE TABLE → GRANT → ENABLE ROW LEVEL SECURITY → POLICY`. PostgREST rejects tables without grants.
3. **Roles:** Live in `user_roles` only — never on `profiles`. Use existing `has_role()`, `has_tenant_role()`, `is_super_admin()` SECURITY DEFINER functions. Do not duplicate.
4. **Routing:** TanStack dot-separated (`$slug.dashboard.tsx`). Protected layout at `src/routes/_authenticated/route.tsx` — do NOT replace. App shell at `src/routes/_app.tsx` — one convention only.
5. **Do NOT touch:** `src/integrations/supabase/{client,client.server,types,auth-middleware,auth-attacher}.ts`, `src/routeTree.gen.ts`, `.env`, `supabase/config.toml`
6. **Secrets:** Via `add_secret` — not `.env`. `process.env.*` server-only; `import.meta.env.VITE_*` client-only.
7. **Test users:** Extended via `handle_new_user` trigger — not raw SQL inserts into `user_roles`. Password: `B00st-Launch!2026$`
8. **BBS:** Separate Lovable app, HMAC-signed webhooks both directions via `BBS_WEBHOOK_SECRET`. Stub exists.
9. **Tenants already seeded:** `cccoeo`, `cccc-mental-health`, `eskaton` — do NOT reseed.
10. **Brand tokens:** oklch in `src/styles.css` — no hard-coded hex, no `bg-orange-500` Tailwind utilities.
11. **Client names:** Never on public marketing pages — generic industry descriptors only.
12. **All migrations:** Use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ALTER TYPE ADD VALUE IF NOT EXISTS` — additive only, no breaking changes.

---

## AI Configuration (Lovable Developer — Step 7a)

- **Client factory:** `src/lib/ai/openai.server.ts` — per-request (not module-scope singleton)
- **Every call must pass:** `metadata: { tenant_id, user_id, feature }`
- **Models:**
  - `gpt-5-mini` — cheap: JD drafts, survey questions, classification
  - `gpt-5` — heavy: course factory, BSG aggregate LLM
  - `text-embedding-3-small` — embeddings
- **AI usage logging:** Every call writes to `ai_usage_log` table (see Step 7a)
- **Tenant scoping:** Every prompt receives `tenant_id`, reads only RLS-scoped rows — no cross-tenant context
- **All AI outputs are drafts** — never auto-applied

---

## Role Hierarchy

| Role | Scope | Description |
|------|-------|-------------|
| `super_admin` | Platform-wide | Jackie Taylor — god mode, all tenants |
| `admin` (legacy) | Platform-wide | Maps to super_admin in `is_super_admin()` |
| `bsg_admin` | Cross-tenant, module-scoped | BSG Inc staff |
| `tenant_admin` | Org-wide within their tenant | Client administrator |
| `manager` | Team-level within their tenant | People manager |
| `learner` | Own data only | Employee / individual contributor |

---

## Test Users

| Email | Role | Tenant | Use |
|-------|------|--------|-----|
| `jackie@boost.test` | super_admin | All | Platform god mode |
| `admin@boost.test` | bsg_admin | Cross-tenant | BSG Admin panel |
| `tenant.admin@boost.test` | tenant_admin | cccoeo | Client admin view |
| `manager@boost.test` | manager | cccoeo | Manager view |
| `learner@boost.test` | learner | cccoeo | Employee view |

Password: `B00st-Launch!2026$`  
Added via `handle_new_user` trigger extension — NOT raw SQL inserts.

---

## Module Color Assignments

| Module | Color | Hex | oklch token |
|--------|-------|-----|-------------|
| Boost!Roles | Orange | `#F7941D` | `--boost-roles` |
| Boost!Perform | Hot Pink | `#E8437A` | `--boost-perform` |
| Boost!Pulse | Purple | `#9B1FBF` | `--boost-pulse` |
| Boost!Learn | Deep Navy | `#0F1F5C` | `--boost-learn` |

---

## Steps 1–6 (Perplexity Computer)

### Step 1 — Read Existing Schema ✅ COMPLETE
Read all 14 migrations. Key findings:
- `app_role` enum already has: `admin`, `student`, `super_admin`, `tenant_admin`, `instructor`, `learner`, `mentor`
- Need to add: `bsg_admin`, `manager` via `ALTER TYPE ADD VALUE IF NOT EXISTS`
- These tables already exist (partial BOOST! work): `job_descriptions`, `perform_goals`, `perform_review_cycles`, `perform_goal_categories`, `pulse_cadences`, `org_chart_nodes`, `boost_agent_conversations`
- `tenants` table exists with: `id, slug, name, kind, logo_url, brand_primary, brand_secondary, welcome_copy, settings, powered_by_boost_footer`
- `tenant_members` exists (links users to tenants with role)
- `enrollments`, `courses`, `modules`, `lessons`, `assessments` all exist (Boost!Learn foundation)
- `is_super_admin()`, `has_tenant_role()`, `has_role()`, `is_tenant_member()` all exist — use these, don't recreate
- `handle_new_user` trigger exists — extend for new test emails
- Email infra exists: `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`
- Existing tenants: `boost`, `apprenticeship`, `client-one/two/three` (generic placeholders)
- BOOST! client tenants (`cccoeo`, `cccc-mental-health`, `eskaton`) NOT yet in DB — add in migration

### Step 2 — Database Migrations

**Migration 2a — Core: Roles expansion + tenants expansion + audit_trail**
- `ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'bsg_admin'`
- `ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager'`
- Extend `tenants` table: `naics_code`, `naics_description`, `website`, `billing_email`, `subscription_tier`, `modules_enabled JSONB`, `culture_doc_url`, `onboarding_call_transcript_url`, `onboarding_completed_at`
- Extend `handle_new_user` for `tenant.admin@boost.test` and `manager@boost.test`
- Seed BOOST! client tenants: `cccoeo`, `cccc-mental-health`, `eskaton`, update `boost` slug
- `audit_trail` table (tenant_id, user_id, action, entity_type, entity_id, payload JSONB, ip_address, created_at)

**Migration 2b — Boost!Roles**
- Extend existing `job_descriptions` or create full spec version
- `career_ladders`, `pay_bands`, `job_history`, `naics_codes`, `promotion_readiness`
- `perform_competency_templates`

**Migration 2c — Boost!Perform**
- Extend `perform_goals` → `perform_targets` (rename via view or new table)
- `perform_reviews` (full spec with weighted_score, goal_ratings JSONB, etc.)
- `perform_review_sections`, `potential_ratings`, `bonus_pool_configs`
- `kudos`, `exit_surveys`, `manager_effectiveness_scores`
- `conversation_coach_sessions`, `employee_goal_coach_sessions`
- `training_recommendations`

**Migration 2d — Boost!Pulse + seed survey dimensions**
- `pulse_surveys` (separate from existing `surveys` table — not a patch)
- `pulse_responses`, `survey_dimensions`
- Seed 15 dimensions from: Great Place to Work, Gallup Q12, Google Aristotle, Edmondson

**Migration 2e — Boost!Learn (extend existing)**
- Extend `courses` and `enrollments` for BOOST!Learn specifics
- `course_enrollments` wrapper if needed
- `certifiably_credentials` stub table

**Migration 2f — Client Onboarding + Reporting**
- `client_onboarding_sessions`, `onboarding_contacts`, `culture_documents`
- `onboarding_transcripts`
- `report_exports`
- `ceo_dashboard_configs`
- `tenant_integrations` (for Rippling/Gusto/TalentLMS opt-in toggle)

### Step 3 — Merge redesign/screens branch
- Pull `redesign/screens`, inventory v0 components
- Resolve conflicts with existing `_app.tsx` layout
- Single layout convention — no second layout system

### Step 4 — Auth + Tenant Routing
- Slug-based routes: `src/routes/_app/$slug.dashboard.tsx` pattern
- Role-gated guards using `has_tenant_role()` and `is_super_admin()`
- BSG Admin cross-tenant routing

### Step 5 — Module by Module (Roles → Perform → Pulse → Learn)
Per module:
- `src/lib/[module]/*.functions.ts` — `createServerFn` server logic
- `src/routes/_app/$slug.[module].*.tsx` — route files  
- `src/components/[module]/` — UI components
- oklch tokens only — no hex codes

### Step 6 — AI Server Functions
- `src/lib/ai/openai.server.ts` — client factory + `logged()` wrapper → `ai_usage_log`
- `src/lib/ai/jd-generator.functions.ts` — gpt-5-mini
- `src/lib/ai/career-ladder.functions.ts` — gpt-5-mini
- `src/lib/ai/conversation-coach.functions.ts` — Claude Sonnet (external, BYOK)
- `src/lib/ai/goal-coach.functions.ts` — Claude Haiku (external, BYOK)
- `src/lib/ai/survey-questions.functions.ts` — gpt-5-mini
- `src/lib/ai/salary-benchmark.functions.ts` — gpt-5
- `src/lib/ai/bsg-aggregate.functions.ts` — gpt-5 (super_admin only, anonymized)
- `src/lib/ai/transcript-ingestion.functions.ts` — gpt-5-mini

---

## Steps 7–8 (Lovable Developer)

### Step 7 — Integrations

**7a. OpenAI wiring**
- `src/lib/ai/openai.server.ts`: factory + `logged()` wrapper → `ai_usage_log`
- Migration: `ai_usage_log` (tenant_id, user_id, feature, model, prompt_tokens, completion_tokens, total_cost_usd, latency_ms, status, error, request_id, created_at)
- `add_secret` for `OPENAI_API_KEY`
- SuperAdmin tile: `/admin/ai-usage` — 30-day spend by tenant/feature/model

**7b. Stripe (sandbox → live)**
- Extend subscription flow: tenant tiers + one-time course purchases
- Webhook handlers: `customer.subscription.*`, `invoice.payment_*`
- `src/lib/billing.functions.ts`: `createSubscriptionCheckout`, `getMySubscription`, `cancelSubscription`, `createPortalSession`
- Tenant-admin route `admin.billing.tsx`: current plan, invoices, portal
- SuperAdmin go-live checklist panel

**7c. Rippling (Eskaton-scoped)**
- `src/lib/integrations/rippling.ts` — stub when `RIPPLING_API_KEY` missing
- Scoped to Eskaton tenant only
- `syncEmployees`, `pushOnboardingComplete`
- Nightly pg_cron → `/api/public/rippling/sync` (HMAC-protected)
- Admin row in `admin.integrations.tsx`

**7d. Certifiably (stub → live)**
- Existing stub + retry queue (pg_cron every 30 min, max 5 tries)
- Swap to real endpoint when Jackie ships API docs (one-file change)
- Admin view: pending credentials, errors, retry

**7e. TalentLMS (stub)**
- Adapter in stub mode
- `tenant_integrations` row + UI toggle for opt-in
- Document `TALENTLMS_DOMAIN`, `TALENTLMS_API_KEY` in `docs/integrations.md`

### Step 8 — Playwright + CI

**8a. Local harness**
- `tests/e2e/` with Playwright config → `http://localhost:8080`
- Supabase session injection for auth specs
- Fixtures: `superAdmin`, `bsgAdmin`, `tenantAdmin`, `manager`, `learner`, `signedOut`

**8b. Coverage (smoke + critical path)**
- Public: `/`, `/auth`, `/c/$slug` render without errors; no client logos
- Auth: every role → correct landing route
- Role gates: learner reads JD, cannot edit; manager blocked from self-review
- Modules: Roles, Perform, Pulse, Learn critical paths
- AI logging: JD generate → `ai_usage_log` row with correct `tenant_id`
- Integrations smoke: Stripe sandbox, Certifiably stub, BBS webhook HMAC

**8c. GitHub Actions**
- `.github/workflows/e2e.yml`: bun deps → build → preview → playwright test
- Separate `lint-typecheck.yml` for tsgo + eslint
- Runs on push to `main` and PRs; uploads HTML report on failure

**8d. Test hygiene**
- Tenant slug `cccoeo` + seeded test users
- Mutations prefixed with per-run UUID; cleanup hook removes them
- AI specs: `gpt-5-mini` with `max_tokens: 50` to minimize CI cost

---

## Key URLs & References
- **Repo root:** https://github.com/Boost-Strategy-Group/dc-license-ace
- **Docs:** https://github.com/Boost-Strategy-Group/dc-license-ace/tree/main/docs
- **Migrations:** https://github.com/Boost-Strategy-Group/dc-license-ace/tree/main/supabase/migrations
- **Supabase project:** `pwcexdecqygnxmxipfbt`
- **App URL (prod):** `app.boostworkforce.com`
- **BBS webhook secret:** `BBS_WEBHOOK_SECRET` (via add_secret)

---

## Pricing Reference
| Tier | Employees | Modules | Monthly | Annual (15% off) |
|------|-----------|---------|---------|-----------------|
| Starter | ≤25 | 1 | $149 | $1,521 |
| Growth | ≤50 | 2 | $299 | $3,050 |
| Suite | ≤75 | All 4 | $499 | $5,090 |
| Enterprise | ≤100 | All 4 + Priority | $699 | $7,130 |

Add-ons: AI Course Generation $49/course | Certifiably $2/credential | Live Sessions $99/session  
Founding client: 40% off 12 months in exchange for testimonial
