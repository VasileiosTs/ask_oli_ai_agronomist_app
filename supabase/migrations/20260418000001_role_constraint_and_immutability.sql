-- ============================================================
-- Fix 1: Extend users_role_check to cover all 5 onboarding roles
--        (farmer, agronomist, cooperative, enterprise, hobbyist)
--        Previous constraint only allowed farmer|agronomist,
--        causing upsert failures for 3 of the 5 new onboarding roles.
--
-- Fix 2: Add prevent_role_change trigger (mirrors prevent_tier_change)
--        so authenticated clients cannot modify their own role post-signup.
--        Service role bypasses triggers (intended — Stripe webhook, admin).
-- ============================================================

-- 1. Widen the role CHECK constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('farmer', 'agronomist', 'cooperative', 'enterprise', 'hobbyist'));

-- 2. Role-immutability trigger
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow role to be set on initial insert (OLD.role is NULL)
  IF OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Cannot modify role from client';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_change ON public.users;
CREATE TRIGGER trg_prevent_role_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_change();
