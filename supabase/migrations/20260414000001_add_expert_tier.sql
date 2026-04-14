-- Add 'expert' as an allowed tier value alongside the existing 'agronomist'.
-- Both expert and agronomist get the advisor (My Growers) interface.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tier_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_tier_check
  CHECK (tier IN ('free', 'pro', 'agronomist', 'expert', 'enterprise'));
