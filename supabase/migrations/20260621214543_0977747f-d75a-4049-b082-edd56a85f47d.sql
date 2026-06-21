
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS certifier_group_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'free';

CREATE UNIQUE INDEX IF NOT EXISTS enrollments_stripe_session_id_uniq
  ON public.enrollments(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
