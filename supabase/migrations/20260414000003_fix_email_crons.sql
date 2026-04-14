-- ============================================================
-- Fix email crons + drop redundant DB functions (April 2026)
--
-- Previous cron schedule used current_setting('app.settings.*')
-- which requires superuser. Replaced with hardcoded URL + anon key
-- (same pattern as 20260402120000_vio_push_cron.sql).
--
-- send-email edge function updated to accept CRON_SECRET in
-- addition to service role key. Set CRON_SECRET in Supabase
-- Dashboard → Settings → Edge Functions → Manage secrets.
-- Use the anon key value below as the secret value.
--
-- RESEND_API_KEY must also be set in edge function secrets
-- for emails to actually send.
-- ============================================================

-- 1. Drop redundant DB functions from 20260414000002
DROP FUNCTION IF EXISTS public.send_followup_emails();
DROP FUNCTION IF EXISTS public.send_weekly_plan_emails();

-- 2. Remove cron jobs added by 20260414000002
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'oli-followup-emails') THEN
    PERFORM cron.unschedule('oli-followup-emails');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'oli-weekly-plan-emails') THEN
    PERFORM cron.unschedule('oli-weekly-plan-emails');
  END IF;
END
$$;

-- 3. Reschedule vio-email-reminders with hardcoded URL + anon key
SELECT cron.unschedule('vio-email-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'vio-email-reminders'
);
SELECT cron.schedule(
  'vio-email-reminders',
  '30 */6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://julraghuunmzqxcayict.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHJhZ2h1dW5tenF4Y2F5aWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1NDcsImV4cCI6MjA4OTU5MDU0N30.6EbPVZJD4d0IcbUwif9qgR2l89rUxmmGFY9w29f_dV4',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHJhZ2h1dW5tenF4Y2F5aWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1NDcsImV4cCI6MjA4OTU5MDU0N30.6EbPVZJD4d0IcbUwif9qgR2l89rUxmmGFY9w29f_dV4'
    ),
    body    := '{"mode":"vio_email_cron"}'::jsonb
  );
  $$
);

-- 4. Reschedule weekly-digest with hardcoded URL + anon key
SELECT cron.unschedule('weekly-digest') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-digest'
);
SELECT cron.schedule(
  'weekly-digest',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url     := 'https://julraghuunmzqxcayict.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHJhZ2h1dW5tenF4Y2F5aWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1NDcsImV4cCI6MjA4OTU5MDU0N30.6EbPVZJD4d0IcbUwif9qgR2l89rUxmmGFY9w29f_dV4',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHJhZ2h1dW5tenF4Y2F5aWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1NDcsImV4cCI6MjA4OTU5MDU0N30.6EbPVZJD4d0IcbUwif9qgR2l89rUxmmGFY9w29f_dV4'
    ),
    body    := '{"mode":"weekly_digest_cron"}'::jsonb
  );
  $$
);
