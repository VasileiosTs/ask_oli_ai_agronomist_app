-- Rename the 'agronomist' tier value to 'master' across the users table.
-- The internal tier was always displayed as "Master" in the UI — this makes
-- the DB value consistent with the display name.

-- Step 1: Update the check constraint to allow 'master' (drop old, add new)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tier_check;
ALTER TABLE public.users ADD CONSTRAINT users_tier_check
  CHECK (tier IN ('free', 'pro', 'master', 'enterprise'));

-- Step 2: Migrate existing rows (bypass the prevent_tier_change trigger)
ALTER TABLE public.users DISABLE TRIGGER trg_prevent_tier_change;

UPDATE public.users
SET tier = 'master'
WHERE tier = 'agronomist';

ALTER TABLE public.users ENABLE TRIGGER trg_prevent_tier_change;
