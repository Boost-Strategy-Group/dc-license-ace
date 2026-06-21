## GoSprout Launchpad (lightweight handoff, not a full integration)

GoSprout doesn't publish a public API or a standard SSO/SAML/OIDC endpoint we can self-configure. Since the goal is "learners click a button in BOOST and land in GoSprout to log their RTI/apprenticeship hours," we'll build a **launchpad tile** rather than a data integration. If GoSprout later confirms SAML or OAuth support, we layer real SSO on top of the same UI.

### What gets built

1. **`gosprout_links` table** (per-learner)
   - `user_id`, `tenant_id`, `gosprout_username` (optional), `gosprout_program_url` (the deep link the org gives each apprentice), `status` (`invited` / `active` / `inactive`), `last_launched_at`
   - RLS: learner reads own row; tenant admins manage rows in their tenant; super_admin all
   - GRANTs for `authenticated` + `service_role`

2. **Tenant-level config** on existing `tenants` table (or new `tenant_gosprout_config`):
   - `gosprout_enabled`, `gosprout_default_login_url` (e.g. `https://app.gosprout.com/login`), `gosprout_org_slug`, `instructions_md`

3. **Learner UI — "Apprenticeship Tools" card** on the learner dashboard and on any course flagged `is_apprenticeship_rti = true`:
   - Shows GoSprout logo + "Log your apprenticeship hours in GoSprout"
   - Primary button → opens `gosprout_program_url` (or default login URL) in a new tab
   - Records `last_launched_at` via a server fn so admins can see engagement
   - Empty state: "Your sponsor hasn't linked you to GoSprout yet"

4. **Admin UI — "GoSprout" tab in tenant admin**:
   - Toggle enable/disable
   - Paste org login URL + instructions
   - Roster table: for each apprentice, set their GoSprout username + personal program link, mark active/inactive
   - CSV import for bulk roster mapping

5. **RTI completion hook (manual, no API)**:
   - When a learner completes a course marked as RTI, we surface a "Report this to GoSprout" reminder + a copy-to-clipboard summary (course name, CEUs, hours, completion date, certificate URL) the learner or mentor pastes into GoSprout. This is the bridge until a real API exists.

6. **Future-ready adapter stub** (`src/lib/integrations/gosprout.ts`):
   - Empty `pushRtiCompletion()` / `syncRoster()` functions behind an `integration_mode: 'launchpad' | 'api'` flag — so when you get API credentials we swap implementations without touching UI.

### What this is NOT (call out explicitly)
- Not true SSO — learners still sign in to GoSprout with their GoSprout credentials. True SSO requires GoSprout to enable SAML/OIDC for your org; we'll wire it the same day they do.
- No automatic hours/competency sync.
- No webhook from GoSprout back to BOOST.

### Next step on your side
Email GoSprout support and ask three questions:
1. Do you offer SAML 2.0 or OIDC SSO on our plan?
2. Do you offer a REST API for roster + completions + hours?
3. Can you provide per-learner deep-link/invite URLs we can store?

Their answers determine whether we keep this as a launchpad or upgrade to bi-directional sync later.

### Files touched
- `supabase/migrations/<ts>_gosprout_launchpad.sql` (new table, grants, RLS, tenant columns)
- `src/lib/gosprout.functions.ts` (record launch, upsert link, list roster)
- `src/lib/integrations/gosprout.ts` (adapter stub)
- `src/components/learner/GoSproutCard.tsx`
- `src/components/learner/RtiReportReminder.tsx`
- `src/routes/_authenticated/admin/tenants.$tenantId.gosprout.tsx`
- Learner dashboard + course detail: mount the card when tenant has GoSprout enabled
