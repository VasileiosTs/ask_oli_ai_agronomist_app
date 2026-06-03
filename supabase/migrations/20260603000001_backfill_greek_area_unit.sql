-- Backfill: Greek/Cypriot growers wrongly persisted with area_unit = 'ha'.
--
-- Root cause (fixed in app code): the OAuth/magic-link auto-create path in
-- AuthenticatedShell.tsx derived the unit from `localStorage 'oli_lang_manual'
-- ?? 'en'`. That key is only set when a user MANUALLY taps the language toggle.
-- A Greek grower whose UI auto-detected Greek (browser language or the
-- Europe/Athens / Asia/Nicosia timezone) never taps it, so the key was empty,
-- detectedLang fell back to 'en', and area_unit was hard-persisted as 'ha'.
-- Because every read site uses `area_unit ?? default`, the wrong value never
-- self-heals once stored.
--
-- This one-time backfill flips those rows to 'stremma' (the Greek/Cypriot unit,
-- 0.1 ha). 'ha' is not a unit Greek farmers use, so flipping it back carries no
-- real risk of overwriting a deliberate choice. Acre users are left untouched.
--
-- Target cohort = persisted 'ha' AND looks Greek/Cypriot by EITHER:
--   (a) language = 'el'  (device/UI Greek), OR
--   (b) GPS inside a Greece or Cyprus bounding box (catches growers on an
--       English-language phone, whose `language` column was also mis-saved 'en').

UPDATE public.users
SET area_unit = 'stremma'
WHERE area_unit = 'ha'
  AND (
    language = 'el'
    OR (
      location_lat IS NOT NULL AND location_lon IS NOT NULL
      AND (
        -- Greece (mainland + islands + Crete)
        (location_lat BETWEEN 34.7 AND 41.8 AND location_lon BETWEEN 19.3 AND 29.7)
        -- Cyprus
        OR (location_lat BETWEEN 34.5 AND 35.7 AND location_lon BETWEEN 32.2 AND 34.6)
      )
    )
  );
