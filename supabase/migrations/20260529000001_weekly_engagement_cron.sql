-- Schedule weekly engagement push/email every Monday at 09:00 UTC.
-- Targets users active in the last 30 days (sent at least one chat message).
-- Channel: silent push notification first; falls back to Resend email.
-- Deep-link in email: /chat?prompt=<encoded> — auto-sends a crop-specific question.
-- Auth: service role key (hardcoded — same pattern as weekly_plan_cron migration).

SELECT cron.unschedule('weekly-engagement') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-engagement'
);

SELECT cron.schedule(
  'weekly-engagement',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url     := 'https://julraghuunmzqxcayict.supabase.co/functions/v1/send-weekly-engagement',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHJhZ2h1dW5tenF4Y2F5aWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1NDcsImV4cCI6MjA4OTU5MDU0N30.6EbPVZJD4d0IcbUwif9qgR2l89rUxmmGFY9w29f_dV4',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1bHJhZ2h1dW5tenF4Y2F5aWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMTQ1NDcsImV4cCI6MjA4OTU5MDU0N30.6EbPVZJD4d0IcbUwif9qgR2l89rUxmmGFY9w29f_dV4'
    ),
    body    := '{"mode":"engagement_cron","cron_secret":"oli-engage-2026"}'::jsonb
  );
  $$
);
