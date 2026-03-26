-- ============================================================
-- CRON JOBS: Onboarding drip + Re-engagement emails
-- ============================================================

-- ── 4. ONBOARDING DRIP — daily at 10:00 UTC ──
-- Sends Day 3 and Day 7 emails to new users
SELECT cron.unschedule('onboarding-drip') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'onboarding-drip'
);

SELECT cron.schedule(
  'onboarding-drip',
  '0 10 * * *',  -- daily at 10:00 UTC
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

-- ── 5. RE-ENGAGEMENT — daily at 11:00 UTC ──
-- Emails users inactive for 14-21 days (sent once per user in that window)
SELECT cron.unschedule('reengagement') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reengagement'
);

SELECT cron.schedule(
  'reengagement',
  '0 11 * * *',  -- daily at 11:00 UTC
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
