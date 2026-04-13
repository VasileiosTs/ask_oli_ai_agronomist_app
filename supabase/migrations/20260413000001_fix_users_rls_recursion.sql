-- ============================================================
-- Fix: infinite recursion in users RLS policy (April 13 2026)
-- The WITH CHECK clause in users_own_users queried the users
-- table from within a policy on users → infinite recursion on
-- every INSERT/UPDATE (signup, onboarding completion).
-- Also: new-user INSERTs would fail because the tier subquery
-- returned NULL for non-existent rows.
--
-- Fix: revert to a clean auth_id-only policy and enforce the
-- tier-immutability rule via a BEFORE UPDATE trigger instead.
-- Service role bypasses both RLS and triggers (intended).
-- ============================================================

-- 1. Restore clean users policy (no self-referential subquery)
DROP POLICY IF EXISTS "users_own_users" ON public.users;
CREATE POLICY "users_own_users" ON public.users
  FOR ALL TO authenticated
  USING  (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- 2. Prevent client-side tier upgrades via trigger instead
CREATE OR REPLACE FUNCTION public.prevent_tier_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tier IS DISTINCT FROM OLD.tier THEN
    RAISE EXCEPTION 'Cannot modify tier from client';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_tier_change ON public.users;
CREATE TRIGGER trg_prevent_tier_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tier_change();
