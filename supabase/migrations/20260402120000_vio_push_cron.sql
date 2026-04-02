-- ─────────────────────────────────────────────────────────────────────────────
-- VIO Push Notification Cron Job
--
-- Sets up a pg_cron job that calls the send-push Edge Function every 6 hours
-- to deliver overdue VIO follow-up push notifications.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove old job if it exists (safe re-run)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'oli-vio-push-notifications') THEN
    PERFORM cron.unschedule('oli-vio-push-notifications');
  END IF;
END
$$;

-- Schedule: every 6 hours at minute 0 (00:00, 06:00, 12:00, 18:00 UTC)
SELECT cron.schedule(
  'oli-vio-push-notifications',
  '0 */6 * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://julraghuunmzqxcayict.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey',       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHJhZ2h1dW5tenF4Y2F5aWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1NDcsImV4cCI6MjA4OTU5MDU0N30.6EbPVZJD4d0IcbUwif9qgR2l89rUxmmGFY9w29f_dV4'
    ),
    body    := '{"mode":"vio_cron"}'::jsonb
  );
  $job$
);
