-- Schedule weekly engagement push/email every Monday at 09:00 UTC.
-- Targets users active in the last 30 days (sent at least one chat message).
-- Channel: silent push notification first; falls back to Resend email.
-- Deep-link in email: /chat?prompt=<encoded> — auto-sends a crop-specific question.
-- Auth: service role key (via app.settings.service_role_key).

SELECT cron.unschedule('weekly-engagement') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-engagement'
);

SELECT cron.schedule(
  'weekly-engagement',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/send-weekly-engagement',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body    := '{"mode":"engagement_cron"}'::jsonb
  );
  $$
);
