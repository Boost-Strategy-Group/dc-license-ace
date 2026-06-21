# Phase D.1 — HeyGen Secret + Lovable Built-in Stripe

Two focused changes. No course preview or activity test bench this round (we can do those next).

## 1. HeyGen
- Add `HEYGEN_API_KEY` to project secrets via the secure form (you paste the key once, it lands as `process.env.HEYGEN_API_KEY` in server functions).
- No code changes needed — `src/lib/integrations.functions.ts` already reads `HEYGEN_API_KEY`. After the secret lands, the `/admin` HeyGen generator and lesson player become live.
- Verify on `/admin/integrations` (HeyGen row should flip to "Connected") and by generating a 1-line test script from the AI Factory page.

## 2. Stripe — switch from BYOK to Lovable built-in
Replace the manual `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` path with Lovable's managed Stripe so you don't juggle keys or webhook endpoints.

**Setup**
- Run eligibility check (digital products / SaaS → expected to recommend Stripe with full compliance handling for course sales).
- Call `enable_stripe_payments`. You fill out the short form (email, business name). A sandbox environment is created instantly; going live is a separate verification step you do later in the Payments dashboard.

**Code refactor**
- `src/lib/integrations.functions.ts` → rewrite `createCheckoutSession` to use the managed Stripe client/helpers provided by the integration (no `STRIPE_SECRET_KEY` env lookup).
- `src/routes/api/public/stripe.webhook.ts` → delete and replace with the managed webhook handler pattern; enrollment activation logic (mark `enrollments.status = 'active'` on `checkout.session.completed`) is preserved verbatim.
- `src/routes/_app/catalog.tsx` → unchanged UX; "Buy & Enroll" button just calls the new server fn.
- `src/routes/_app/admin.integrations.tsx` → swap Stripe row from "needs STRIPE_SECRET_KEY" to "Managed by Lovable Payments" with a link to the Payments dashboard.
- Add tax code per course product (we'll default to a generic digital-education tax code; you can refine per course later).

**Products**
- After enable + refactor, we create Stripe products/prices for any existing courses with `price_cents > 0` using `batch_create_product`. New courses created in admin will auto-create their Stripe product.

## Out of scope (next round if you want)
- Course Preview (as Learner) mode
- Activity Test Bench drawer
- Needs Assessment "regenerate with notes" loop

## Order of operations on approve
1. Add `HEYGEN_API_KEY` secret (form pops up)
2. Run Stripe eligibility check
3. Call `enable_stripe_payments` (form pops up)
4. Refactor checkout fn + webhook route
5. Seed Stripe products for existing paid courses
6. Verify: HeyGen test generation + Stripe sandbox checkout end-to-end
