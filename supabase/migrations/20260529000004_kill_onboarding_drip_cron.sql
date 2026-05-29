-- Remove onboarding drip cron. Welcome email covers new-user activation.
-- Handler removed from send-email Edge Function in the same commit.

SELECT cron.unschedule('onboarding-drip') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'onboarding-drip'
);
