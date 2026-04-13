-- ============================================================
-- Fix: remove duplicate re-engagement cron job (April 13 2026)
-- 20260326200000 scheduled 'reengagement' at 11:00 UTC.
-- 20260326500000 added 'reengagement-email' at 10:00 UTC but
-- never unscheduled 'reengagement', leaving both running and
-- sending re-engagement emails twice daily to inactive users.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reengagement') THEN
    PERFORM cron.unschedule('reengagement');
    RAISE NOTICE 'Removed duplicate cron job: reengagement';
  END IF;
END
$$;
