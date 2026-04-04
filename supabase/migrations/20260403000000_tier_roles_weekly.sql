-- ============================================================
-- TIER & ROLES: 4-tier system, user roles, weekly message counter
-- ============================================================

-- 1. User role (farmer = default, agronomist = professional)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'farmer';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_role_check
      CHECK (role IN ('farmer', 'agronomist'));
  END IF;
END $$;

-- 2. Update tier constraint to support 4 tiers
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_tier_check;
ALTER TABLE public.users ADD CONSTRAINT users_tier_check
  CHECK (tier IN ('free', 'pro', 'agronomist', 'enterprise'));

-- 3. Weekly message tracking (replaces monthly for free tier enforcement)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS message_count_week INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS message_week_reset TIMESTAMPTZ;

-- 4. Report tracking (for Phase 3 report generation limits)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS report_count_month INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS report_month_reset TIMESTAMPTZ;

-- 5. Initialize weekly counts for existing users
-- Set reset date to next Monday for all users without one
UPDATE public.users
SET message_week_reset = date_trunc('week', now() + interval '7 days')
WHERE message_week_reset IS NULL;
