-- ============================================================
-- Security Fixes — April 9 2026
-- 1. Prevent authenticated users from self-upgrading tier
-- 2. FORCE ROW LEVEL SECURITY on crops and memory_snapshots
-- ============================================================

-- ── 1. Tier write-protection ──────────────────────────────────
-- Replace the unrestricted FOR ALL policy with one that locks
-- the tier column against client-side changes.
-- Service role bypasses RLS entirely, so admin tier upgrades
-- (via service-role-keyed functions) continue to work.

DROP POLICY IF EXISTS "users_own_users" ON public.users;

CREATE POLICY "users_own_users" ON public.users
  FOR ALL TO authenticated
  USING (auth_id = auth.uid())
  WITH CHECK (
    auth_id = auth.uid()
    -- Prevent client-side tier upgrades: new row must keep the same tier
    -- Service role bypasses this check entirely (intended)
    AND tier = (SELECT tier FROM public.users WHERE auth_id = auth.uid())
  );

-- ── 2. FORCE RLS on tables missing it ────────────────────────
ALTER TABLE IF EXISTS public.crops             FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.memory_snapshots  FORCE ROW LEVEL SECURITY;
