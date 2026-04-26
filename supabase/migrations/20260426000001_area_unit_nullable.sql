-- Remove the hard-coded 'ha' default so the app can set the correct unit
-- based on the user's detected language during onboarding.
ALTER TABLE public.users
  ALTER COLUMN area_unit DROP DEFAULT,
  ALTER COLUMN area_unit DROP NOT NULL;
