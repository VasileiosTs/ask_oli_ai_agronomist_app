-- Rename the 'agronomist' tier value to 'master' across the users table.
-- The internal tier was always displayed as "Master" in the UI — this makes
-- the DB value consistent with the display name.
-- Bypass the prevent_tier_change trigger (this is a bulk migration, not a client request).

ALTER TABLE public.users DISABLE TRIGGER trg_prevent_tier_change;

UPDATE public.users
SET tier = 'master'
WHERE tier = 'agronomist';

ALTER TABLE public.users ENABLE TRIGGER trg_prevent_tier_change;
