-- Rename the 'agronomist' tier value to 'master' across the users table.
-- The internal tier was always displayed as "Master" in the UI — this makes
-- the DB value consistent with the display name.

UPDATE public.users
SET tier = 'master'
WHERE tier = 'agronomist';
