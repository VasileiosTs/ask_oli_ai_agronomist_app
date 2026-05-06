-- Schedule weekly plan emails every Monday at 07:00 UTC.
-- Targets users with notification_weekly_plan = true.
-- Uses the same anon-key pattern as other email crons.

SELECT cron.unschedule('weekly-plan') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-plan'
);

SELECT cron.schedule(
  'weekly-plan',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url     := 'https://julraghuunmzqxcayict.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHJhZ2h1dW5tenF4Y2F5aWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1NDcsImV4cCI6MjA4OTU5MDU0N30.6EbPVZJD4d0IcbUwif9qgR2l89rUxmmGFY9w29f_dV4',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHJhZ2h1dW5tenF4Y2F5aWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1NDcsImV4cCI6MjA4OTU5MDU0N30.6EbPVZJD4d0IcbUwif9qgR2l89rUxmmGFY9w29f_dV4'
    ),
    body    := '{"mode":"weekly_plan_cron"}'::jsonb
  );
  $$
);
