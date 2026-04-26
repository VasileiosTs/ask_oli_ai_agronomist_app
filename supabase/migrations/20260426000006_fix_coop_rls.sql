-- Fix: cooperative_admins RLS policy causes infinite recursion because
-- the policy queries cooperative_admins to determine access to cooperative_admins.
-- Solution: use a SECURITY DEFINER function to bypass RLS for the admin check.

CREATE OR REPLACE FUNCTION public.is_coop_admin(p_coop_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cooperative_admins ca
    JOIN public.users u ON u.id = ca.user_id
    WHERE ca.cooperative_id = p_coop_id
      AND u.auth_id = auth.uid()
  );
$$;

-- Drop recursive policies and replace with non-recursive versions
DROP POLICY IF EXISTS "coop_admin_all"  ON public.cooperatives;
DROP POLICY IF EXISTS "coop_admin_mgmt" ON public.cooperative_admins;
DROP POLICY IF EXISTS "coop_member_mgmt" ON public.cooperative_members;

-- cooperatives: admins can see/manage their cooperative
CREATE POLICY "coop_admin_all" ON public.cooperatives
  FOR ALL USING (public.is_coop_admin(id));

-- cooperative_admins: users can see their own rows; admin-level management bypasses via is_coop_admin
CREATE POLICY "coop_admin_select" ON public.cooperative_admins
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR public.is_coop_admin(cooperative_id)
  );

CREATE POLICY "coop_admin_modify" ON public.cooperative_admins
  FOR ALL USING (public.is_coop_admin(cooperative_id));

-- cooperative_members: admins can manage
CREATE POLICY "coop_member_mgmt" ON public.cooperative_members
  FOR ALL USING (public.is_coop_admin(cooperative_id));
