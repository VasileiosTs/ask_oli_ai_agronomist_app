-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: Remove duplicate VIO push cron job
--
-- 20260402120000_vio_push_cron.sql created 'oli-vio-push-notifications' which
-- duplicates 'vio-push-reminders' from 20260326000000_cron_jobs.sql.
-- The duplicate used a hardcoded anon API key instead of the service_role_key,
-- and ran on the same schedule (0 */6 * * *), causing double notifications.
--
-- This migration removes the bad duplicate and leaves the correct job in place.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'oli-vio-push-notifications') THEN
    PERFORM cron.unschedule('oli-vio-push-notifications');
    RAISE NOTICE 'Removed duplicate cron job: oli-vio-push-notifications';
  END IF;
END
$$;
