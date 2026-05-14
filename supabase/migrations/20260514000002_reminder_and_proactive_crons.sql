-- ============================================================
-- Cron jobs for:
--   1. scheduled-treatment-reminders  (every 6h, staggered from VIO)
--   2. proactive-field-alerts         (daily at 06:00 UTC)
-- ============================================================

-- Anon key + project URL (same pattern as all other crons in this project)
-- Project: julraghuunmzqxcayict.supabase.co

-- 1. Scheduled treatment reminder push
-- Fires send-push in scheduled_cron mode, 45min after VIO push
-- to spread load. Picks up any treatment due within the window.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scheduled-treatment-reminders') THEN
    PERFORM cron.unschedule('scheduled-treatment-reminders');
  END IF;
END
$$;

SELECT cron.schedule(
  'scheduled-treatment-reminders',
  '45 */6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://julraghuunmzqxcayict.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHJhZ2h1dW5tenF4Y2F5aWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1NDcsImV4cCI6MjA4OTU5MDU0N30.6EbPVZJD4d0IcbUwif9qgR2l89rUxmmGFY9w29f_dV4',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHJhZ2h1dW5tenF4Y2F5aWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1NDcsImV4cCI6MjA4OTU5MDU0N30.6EbPVZJD4d0IcbUwif9qgR2l89rUxmmGFY9w29f_dV4'
    ),
    body    := '{"mode":"scheduled_cron"}'::jsonb
  );
  $$
);

-- 2. Proactive field alerts (AI-driven, weather-aware)
-- Runs once daily at 06:00 UTC. Only fires for Pro/Master/Enterprise users.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'proactive-field-alerts') THEN
    PERFORM cron.unschedule('proactive-field-alerts');
  END IF;
END
$$;

SELECT cron.schedule(
  'proactive-field-alerts',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://julraghuunmzqxcayict.supabase.co/functions/v1/proactive-alerts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHJhZ2h1dW5tenF4Y2F5aWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1NDcsImV4cCI6MjA4OTU5MDU0N30.6EbPVZJD4d0IcbUwif9qgR2l89rUxmmGFY9w29f_dV4',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHJhZ2h1dW5tenF4Y2F5aWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1NDcsImV4cCI6MjA4OTU5MDU0N30.6EbPVZJD4d0IcbUwif9qgR2l89rUxmmGFY9w29f_dV4'
    ),
    body    := '{}'::jsonb
  );
  $$
);
