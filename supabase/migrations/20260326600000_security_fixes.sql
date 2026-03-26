-- ============================================================
-- Security fixes: GRANTs, RLS, cron dedup, index, view hardening
-- ============================================================

-- 5. Missing GRANT on push_subscriptions
GRANT SELECT, INSERT, DELETE ON push_subscriptions TO authenticated;

-- 6. vio_step UPDATE logic bug
-- The column was added with DEFAULT 0, so the original
-- "WHERE vio_step IS NULL" never matched. Fix existing rows:
UPDATE interventions
  SET vio_step = 1
  WHERE follow_up_at IS NOT NULL
    AND outcome IS NULL
    AND vio_step = 0;

-- 7. Duplicate cron job definitions
-- Unschedule any stale duplicates first
SELECT cron.unschedule('onboarding-drip') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'onboarding-drip'
);
SELECT cron.unschedule('reengagement-email') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reengagement-email'
);

-- Re-schedule with correct times
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

-- 14. Shared view bypasses RLS — recreate with security_invoker = true
DROP VIEW IF EXISTS public.safe_shared_diagnoses;
CREATE VIEW public.safe_shared_diagnoses
WITH (security_invoker = true)
AS
SELECT
  i.id AS legacy_intervention_id,
  i.share_id,
  i.crop_type,
  i.diagnosis,
  i.problem,
  i.product_applied,
  i.product,
  i.product_category,
  i.dosage,
  i.application_method,
  i.share_summary,
  i.severity,
  i.applied_at,
  i.date,
  i.created_at
FROM public.interventions i
WHERE i.is_shared = true;

GRANT SELECT ON public.safe_shared_diagnoses TO anon, authenticated;

-- 48. photo_reviews cross-user access — ensure message_id belongs to same user
DROP POLICY IF EXISTS "users_own_reviews" ON photo_reviews;
CREATE POLICY "users_own_reviews" ON photo_reviews
  FOR ALL TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    AND message_id IN (SELECT id FROM chat_messages WHERE user_id = photo_reviews.user_id)
  )
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- 49. Unused tables still accessible — revoke access
REVOKE ALL ON memory_snapshots FROM authenticated;
REVOKE ALL ON photo_reviews FROM authenticated;

-- 50. Missing composite index on grower_links
CREATE INDEX IF NOT EXISTS idx_grower_links_grower_field
  ON grower_links (grower_id, field_id);
