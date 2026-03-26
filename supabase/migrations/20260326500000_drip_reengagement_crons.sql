-- Onboarding drip emails (Day 3 & Day 7) — daily at 09:00 UTC
SELECT cron.unschedule('onboarding-drip') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'onboarding-drip'
);

SELECT cron.schedule(
  'onboarding-drip',
  '0 9 * * *',  -- daily at 09:00 UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"mode": "onboarding_drip_cron"}'::jsonb
  );
  $$
);

-- Re-engagement emails (14-day inactive users) — daily at 10:00 UTC
SELECT cron.unschedule('reengagement-email') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reengagement-email'
);

SELECT cron.schedule(
  'reengagement-email',
  '0 10 * * *',  -- daily at 10:00 UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"mode": "reengagement_cron"}'::jsonb
  );
  $$
);
