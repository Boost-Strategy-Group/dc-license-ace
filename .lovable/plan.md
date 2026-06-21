
## Part 1 — Receipt emails (end-to-end)

Goal: when the Stripe webhook marks an enrollment `paid`, the learner gets a branded receipt. Sandbox-friendly; works on the current `lovable.app` subdomain until your custom domain is connected.

### Steps
1. **Email domain setup** — open the email setup dialog so you can pick/verify a sending subdomain (e.g. `notify.dc-license-ace.lovable.app` for now; swap to `notify.yourdomain.com` later — no code changes needed).
2. **Provision email infrastructure** — creates the send queue, send log, suppression list, unsubscribe tokens, cron processor. One-time, automatic.
3. **Scaffold app (transactional) email system** — creates `/lovable/email/transactional/send`, preview route, unsubscribe page, and a sample template.
4. **Add `purchase-receipt` template** in `src/lib/email-templates/`:
   - Branded header (BOOST), course title, amount paid, payment date, enrollment link ("Start learning"), order id, support contact.
   - Registered in `src/lib/email-templates/registry.ts`.
5. **Trigger from the payments webhook** (`src/routes/api/public/payments/webhook.ts`): after enrollment flips to `paid`, call the internal send helper with `idempotencyKey = receipt-<enrollment_id>` so Stripe retries never double-send. Recipient = the buyer's email from the enrollment/profile.
6. **Verify end-to-end**: run a test purchase with `4242 4242 4242 4242` → check inbox + query `email_send_log` for `status = sent`.

### Notes
- Uses Lovable Emails (no third-party key, no per-email cost beyond plan usage).
- Receipts will send even while DNS is still propagating on a fresh domain — they queue and flush once verified.
- Certifier credential on completion + enrollment activation are already wired; this only adds the receipt step.

---

## Part 2 — Brief for v0.dev

v0 works best when you give it (a) what to build, (b) the visual language, and (c) the data shape. Here's a copy-pasteable kit.

### A. Files to share with v0
Paste these into v0's "context" / attachments:
1. **`src/styles.css`** — your Tailwind v4 tokens, colors, fonts, radii. Gives v0 your design system so it doesn't invent its own palette.
2. **`src/components/ui/*`** (button, card, input, badge, dialog, tabs) — your shadcn variants. Tell v0: "Match these component APIs."
3. **One existing page** as the style reference — best pick: `src/routes/_app/catalog.tsx` or `src/routes/_app/dashboard.tsx`. Shows v0 the layout grammar (app shell, spacing, headings).
4. **`src/integrations/supabase/types.ts`** (just the table types for the screen being redesigned, e.g. `courses`, `enrollments`) — so v0 generates components that match real fields.
5. **A screenshot** of the current screen + a screenshot/Figma of the inspiration.

### B. Prompt template for v0

```
You are redesigning a screen for BOOST Learning — a multi-tenant
learning, certification, and credentialing platform.

Stack: React 19 + TanStack Start + Tailwind v4 + shadcn/ui.
Do NOT introduce new dependencies. Use only the shadcn components
shown in the attached ui/ folder. Use semantic tokens from the
attached styles.css (no hardcoded hex, no `text-white`/`bg-black`).

Screen: <e.g. "Course catalog card grid" or "Learner dashboard">
Audience: <self-paced learner | tenant admin | instructor>
Primary actions: <e.g. "Enroll", "Resume course", "Download certificate">
Data shape: <paste the relevant type from types.ts>

Design direction:
- Tone: professional, trustworthy, workforce-development (not playful SaaS).
- Visual: clean, generous whitespace, strong typographic hierarchy,
  subtle depth (no heavy gradients, no purple/indigo defaults).
- Mobile-first, responsive at sm/md/lg/xl.
- Accessibility: WCAG AA contrast, focus rings, semantic HTML, one H1.

Deliver:
1. A single .tsx file using shadcn + Tailwind tokens.
2. Loading + empty + error states.
3. Plain props — no data fetching inside the component.
```

### C. What to ask v0 for, screen by screen
Tell me which screens you want to redesign first and I'll generate a tailored prompt + the exact files to attach for each. Likely candidates: Catalog, Course detail/checkout, Learner dashboard, Lesson player, Admin course builder, Student Business Vault.

### D. Bringing v0 output back
Paste v0's `.tsx` into chat and I'll: wire it to real data (server functions + queries), swap any inline colors for tokens, add route + loader, and verify it renders.

---

## Confirm to proceed
On approval I'll: open the email setup dialog, then scaffold infra + templates + webhook trigger in one pass.
