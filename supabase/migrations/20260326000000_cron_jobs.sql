-- ============================================================
-- CRON JOBS: VIO reminders + Weekly digest
-- Requires pg_cron and pg_net extensions (enabled by default on Supabase)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 1. VIO PUSH REMINDERS — every 6 hours ──
-- Calls send-push Edge Function in vio_cron mode
-- Sends push notifications to users with due VIO follow-ups
SELECT cron.unschedule('vio-push-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'vio-push-reminders'
);

SELECT cron.schedule(
  'vio-push-reminders',
  '0 */6 * * *',  -- every 6 hours: 00:00, 06:00, 12:00, 18:00 UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"mode": "vio_cron"}'::jsonb
  );
  $$
);

-- ── 2. VIO EMAIL REMINDERS — every 6 hours (offset by 30min from push) ──
-- Calls send-email Edge Function in vio_email_cron mode
-- Sends email to users WITHOUT push subscriptions who have due VIO follow-ups
SELECT cron.unschedule('vio-email-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'vio-email-reminders'
);

SELECT cron.schedule(
  'vio-email-reminders',
  '30 */6 * * *',  -- every 6 hours at :30: 00:30, 06:30, 12:30, 18:30 UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"mode": "vio_email_cron"}'::jsonb
  );
  $$
);

-- ── 3. WEEKLY DIGEST — Mondays at 08:00 UTC ──
-- Calls send-email Edge Function in weekly_digest_cron mode
-- Sends weekly summary to all active users
SELECT cron.unschedule('weekly-digest') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-digest'
);

SELECT cron.schedule(
  'weekly-digest',
  '0 8 * * 1',  -- Monday at 08:00 UTC
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"mode": "weekly_digest_cron"}'::jsonb
  );
  $$
);

-- ── Verify jobs are scheduled ──
-- SELECT * FROM cron.job;
