-- Remove weekly-digest and weekly-plan crons.
-- Replaced by weekly-engagement (20260529000001) which handles all Monday outreach
-- and respects the Resend free-plan 100/day limit (cap: 80 emails per run).

SELECT cron.unschedule('weekly-digest') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-digest'
);

SELECT cron.unschedule('weekly-plan') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-plan'
);
