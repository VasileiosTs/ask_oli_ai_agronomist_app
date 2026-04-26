-- Monthly reset cron for report_count_month.
-- report_count_month and report_month_reset columns already exist (migration 20260403000000).
-- This schedules a monthly reset on the 1st of each month at 00:05 UTC.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove old job if it exists
    PERFORM cron.unschedule('monthly-report-reset')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-report-reset');

    PERFORM cron.schedule(
      'monthly-report-reset',
      '5 0 1 * *',  -- 1st of every month at 00:05 UTC
      $$
        UPDATE public.users
        SET
          report_count_month = 0,
          report_month_reset = now()
        WHERE report_count_month > 0;
      $$
    );
  END IF;
END $$;
