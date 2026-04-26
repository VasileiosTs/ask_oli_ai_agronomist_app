-- Fix existing Greek-language users who have area_unit='ha' but should use 'stremma'.
-- The previous migration dropped the DB default so new Greek users are handled at app
-- level (Onboarding sets area_unit based on lang), but existing rows kept their old 'ha'.
UPDATE public.users
SET area_unit = 'stremma'
WHERE (language = 'el' OR language LIKE 'el-%')
  AND (area_unit = 'ha' OR area_unit IS NULL);
