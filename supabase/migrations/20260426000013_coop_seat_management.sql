-- Cooperative seat management:
--   add_coop_member(cooperative_id, member_email) — links agronomist, elevates tier
--   remove_coop_member(cooperative_id, member_user_id) — unlinks, reverts tier
--
-- previous_tier stored so tier is correctly reverted when member leaves.

ALTER TABLE public.cooperative_members
  ADD COLUMN IF NOT EXISTS previous_tier TEXT;

-- ── add_coop_member ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_coop_member(
  p_cooperative_id UUID,
  p_member_email   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id  UUID;
  v_user_id       UUID;
  v_current_tier  TEXT;
BEGIN
  -- Verify caller is the coop admin
  IF NOT EXISTS (
    SELECT 1 FROM public.cooperative_admins ca
    JOIN public.users u ON u.id = ca.user_id
    WHERE u.auth_id = auth.uid()
      AND ca.cooperative_id = p_cooperative_id
  ) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  -- Find auth user by email
  SELECT id INTO v_auth_user_id FROM auth.users WHERE email = p_member_email LIMIT 1;
  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'user_not_found');
  END IF;

  -- Get their public users record + current tier
  SELECT id, tier INTO v_user_id, v_current_tier
  FROM public.users WHERE auth_id = v_auth_user_id LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'user_not_found');
  END IF;

  -- Insert membership, storing previous tier for later reversion
  INSERT INTO public.cooperative_members (cooperative_id, user_id, role, previous_tier)
  VALUES (p_cooperative_id, v_user_id, 'agronomist', v_current_tier)
  ON CONFLICT (cooperative_id, user_id) DO NOTHING;

  -- Elevate to agronomist tier (bypass the prevent_tier_change trigger)
  ALTER TABLE public.users DISABLE TRIGGER trg_prevent_tier_change;
  UPDATE public.users
  SET tier = 'agronomist'
  WHERE id = v_user_id
    AND tier NOT IN ('enterprise');  -- don't downgrade enterprise users
  ALTER TABLE public.users ENABLE TRIGGER trg_prevent_tier_change;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$;

-- ── remove_coop_member ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_coop_member(
  p_cooperative_id   UUID,
  p_member_user_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_tier TEXT;
BEGIN
  -- Verify caller is the coop admin
  IF NOT EXISTS (
    SELECT 1 FROM public.cooperative_admins ca
    JOIN public.users u ON u.id = ca.user_id
    WHERE u.auth_id = auth.uid()
      AND ca.cooperative_id = p_cooperative_id
  ) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  -- Get stored previous tier
  SELECT previous_tier INTO v_previous_tier
  FROM public.cooperative_members
  WHERE cooperative_id = p_cooperative_id AND user_id = p_member_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'member_not_found');
  END IF;

  -- Remove membership
  DELETE FROM public.cooperative_members
  WHERE cooperative_id = p_cooperative_id AND user_id = p_member_user_id;

  -- Revert tier (only if still on agronomist — user may have upgraded themselves)
  ALTER TABLE public.users DISABLE TRIGGER trg_prevent_tier_change;
  UPDATE public.users
  SET tier = COALESCE(v_previous_tier, 'free')
  WHERE id = p_member_user_id
    AND tier = 'agronomist';
  ALTER TABLE public.users ENABLE TRIGGER trg_prevent_tier_change;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute to authenticated users (RLS inside the functions enforces who can call)
GRANT EXECUTE ON FUNCTION public.add_coop_member(UUID, TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_coop_member(UUID, UUID) TO authenticated;
