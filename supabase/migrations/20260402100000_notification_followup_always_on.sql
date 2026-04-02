-- Make notification_followup always-on for all users.
-- New users get it set to true during onboarding (via app payload).
-- Existing users are backfilled here.

-- Ensure column exists (idempotent)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notification_followup BOOLEAN DEFAULT true;

-- Set default to true for any future rows inserted without explicit value
ALTER TABLE public.users
  ALTER COLUMN notification_followup SET DEFAULT true;

-- Backfill all existing users who have it NULL or false
UPDATE public.users
SET notification_followup = true
WHERE notification_followup IS NULL OR notification_followup = false;
