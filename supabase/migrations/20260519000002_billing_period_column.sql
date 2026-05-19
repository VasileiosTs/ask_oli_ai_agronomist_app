-- Add billing_period to users so we can split monthly vs yearly subscribers.
-- Values: 'monthly' | 'yearly' | NULL (free/trial/promo users)
-- Populated by the stripe-webhook on checkout.session.completed
-- and kept current on customer.subscription.updated.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS billing_period text
    CHECK (billing_period IN ('monthly', 'yearly'));
