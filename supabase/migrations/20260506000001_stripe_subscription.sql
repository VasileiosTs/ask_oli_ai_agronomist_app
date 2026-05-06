-- Add stripe_subscription_id for subscription lifecycle tracking
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz;
