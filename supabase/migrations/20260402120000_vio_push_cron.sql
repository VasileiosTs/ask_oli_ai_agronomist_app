-- ─────────────────────────────────────────────────────────────────────────────
-- VIO Push Notification Cron Job
--
-- This migration sets up a pg_cron job that calls the send-push Edge Function
-- every 6 hours to deliver overdue VIO follow-up push notifications.
--
-- BEFORE RUNNING: Replace the two placeholders below with real values:
--   1. __YOUR_PROJECT_REF__  → your Supabase project ref (e.g. abcdefghijkl)
--      Find it in: Supabase dashboard → Settings → General → Reference ID
--   2. __YOUR_CRON_SECRET__  → value of CRON_SECRET env var on your Edge Function
--      Set it in: Supabase dashboard → Edge Functions → send-push → Secrets
--
-- Then paste into: Supabase dashboard → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove old job if it exists (safe re-run)
SELECT cron.unschedule('oli-vio-push-notifications')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'oli-vio-push-notifications'
);

-- Schedule: every 6 hours at minute 0 (00:00, 06:00, 12:00, 18:00 UTC)
SELECT cron.schedule(
  'oli-vio-push-notifications',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://__YOUR_PROJECT_REF__.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', '__YOUR_CRON_SECRET__'
    ),
    body    := '{"mode":"vio_cron"}'::jsonb
  );
  $$
);
