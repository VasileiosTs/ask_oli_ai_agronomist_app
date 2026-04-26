-- Remove expert tier: migrate all expert users to agronomist.
-- The expert tier is not offered on the website and is identical to agronomist.
-- Drop the constraint, update rows, then re-create constraint without 'expert'.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tier_check;

ALTER TABLE public.users DISABLE TRIGGER trg_prevent_tier_change;
UPDATE public.users SET tier = 'agronomist' WHERE tier = 'expert';
ALTER TABLE public.users ENABLE TRIGGER trg_prevent_tier_change;

ALTER TABLE public.users
  ADD CONSTRAINT users_tier_check
  CHECK (tier IN ('free', 'pro', 'agronomist', 'enterprise'));
