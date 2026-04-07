-- ============================================================
-- RLS & Security Hardening — April 7 2026
-- Enables RLS on ALL tables that were missing it,
-- adds missing policies, and fixes public exposure.
-- ============================================================

-- ── 1. Enable RLS on every table that lacked it ──────────────
ALTER TABLE IF EXISTS public.kpi_snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_usage_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.operational_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.guest_ratelimit     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_prefs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.growers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.grower_links        ENABLE ROW LEVEL SECURITY;

-- Core tables — confirm already enabled (idempotent)
ALTER TABLE IF EXISTS public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fields              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interventions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crops               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.memory_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.photo_reviews       ENABLE ROW LEVEL SECURITY;

-- ── 2. push_subscriptions policies ───────────────────────────
DROP POLICY IF EXISTS "users_own_push_subscriptions" ON push_subscriptions;
CREATE POLICY "users_own_push_subscriptions" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Service role bypasses RLS for cron jobs (no policy needed for service role)

-- ── 3. notification_prefs policies ───────────────────────────
DROP POLICY IF EXISTS "users_own_notification_prefs" ON notification_prefs;
CREATE POLICY "users_own_notification_prefs" ON notification_prefs
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ── 4. ai_usage_events — service role write, authenticated read own ──
DROP POLICY IF EXISTS "users_read_own_usage" ON ai_usage_events;
CREATE POLICY "users_read_own_usage" ON ai_usage_events
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Service role inserts (no authenticated insert policy — backend only)

-- ── 5. operational_events — admin read only ───────────────────
DROP POLICY IF EXISTS "admin_read_operational_events" ON operational_events;
CREATE POLICY "admin_read_operational_events" ON operational_events
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (SELECT auth_id FROM users WHERE id IN (SELECT user_id FROM admin_users))
  );

-- ── 6. kpi_snapshots — admin read only ───────────────────────
DROP POLICY IF EXISTS "admin_read_kpi_snapshots" ON kpi_snapshots;
CREATE POLICY "admin_read_kpi_snapshots" ON kpi_snapshots
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (SELECT auth_id FROM users WHERE id IN (SELECT user_id FROM admin_users))
  );

-- ── 7. admin_users — no direct access from clients ───────────
-- Admin status is checked server-side via service role only.
-- No authenticated policy — RLS blocks all client access.

-- ── 8. guest_ratelimit — service role only (no client access) ─
-- No authenticated policy — prevents clients from reading/clearing rate limits.

-- ── 9. growers policies (if not already set) ─────────────────
DROP POLICY IF EXISTS "advisors_own_growers" ON growers;
CREATE POLICY "advisors_own_growers" ON growers
  FOR ALL TO authenticated
  USING (advisor_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (advisor_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "advisors_own_grower_links" ON grower_links;
CREATE POLICY "advisors_own_grower_links" ON grower_links
  FOR ALL TO authenticated
  USING (
    grower_id IN (
      SELECT id FROM growers
      WHERE advisor_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    grower_id IN (
      SELECT id FROM growers
      WHERE advisor_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- ── 10. Revoke public/anon access from sensitive tables ──────
REVOKE ALL ON public.kpi_snapshots      FROM anon;
REVOKE ALL ON public.admin_users        FROM anon;
REVOKE ALL ON public.ai_usage_events    FROM anon;
REVOKE ALL ON public.operational_events FROM anon;
REVOKE ALL ON public.guest_ratelimit    FROM anon;
REVOKE ALL ON public.push_subscriptions FROM anon;

-- ── 11. Ensure safe_shared_diagnoses is the only anon-accessible view ──
-- (Already set in prior migrations — confirm grants are scoped)
REVOKE ALL ON public.safe_shared_diagnoses FROM anon;
GRANT SELECT ON public.safe_shared_diagnoses TO anon;

-- ── 12. Force RLS for table owners (prevent owner bypass) ────
ALTER TABLE IF EXISTS public.users               FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fields              FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations       FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages       FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interventions       FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions  FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_prefs  FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.growers             FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.grower_links        FORCE ROW LEVEL SECURITY;
