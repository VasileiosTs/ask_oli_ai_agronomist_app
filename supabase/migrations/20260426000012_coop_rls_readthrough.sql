-- Allow cooperative admins to READ (SELECT only) their member agronomists' data.
-- This enables the enterprise oversight view without breaking data ownership:
--   - Each agronomist still OWNS their own rows (INSERT/UPDATE/DELETE unchanged)
--   - Coop admin gets a read window across all their members' growers/fields/interventions
--   - Two agronomists in the same coop CANNOT read each other's data

-- ── Helper: check if current user is a coop admin of a given member ──────────
CREATE OR REPLACE FUNCTION public.is_coop_admin_of(p_member_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cooperative_admins ca
    JOIN public.users admin_u ON admin_u.id = ca.user_id
    WHERE admin_u.auth_id = auth.uid()
      AND ca.cooperative_id IN (
        SELECT cm.cooperative_id
        FROM public.cooperative_members cm
        WHERE cm.user_id = p_member_user_id
      )
  );
$$;

-- ── growers: coop admin can SELECT member's growers ──────────────────────────
DROP POLICY IF EXISTS "coop_admin_read_member_growers" ON public.growers;
CREATE POLICY "coop_admin_read_member_growers"
  ON public.growers
  FOR SELECT
  USING (
    -- own growers (existing rule still applies separately)
    advisor_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR
    -- member's growers
    is_coop_admin_of(advisor_id)
  );

-- ── fields: coop admin can SELECT member's fields ────────────────────────────
DROP POLICY IF EXISTS "coop_admin_read_member_fields" ON public.fields;
CREATE POLICY "coop_admin_read_member_fields"
  ON public.fields
  FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR
    is_coop_admin_of(user_id)
  );

-- ── interventions: coop admin can SELECT member's interventions ───────────────
DROP POLICY IF EXISTS "coop_admin_read_member_interventions" ON public.interventions;
CREATE POLICY "coop_admin_read_member_interventions"
  ON public.interventions
  FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR
    is_coop_admin_of(user_id)
  );
