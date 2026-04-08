-- ─────────────────────────────────────────────────────────────────────────────
-- Cooperatives: enterprise-tier orgs that manage multiple agronomist accounts
--
-- cooperative_admins  — maps users → cooperative (admin role)
-- cooperative_members — maps users → cooperative (agronomist members)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cooperatives (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  location    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cooperative_admins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cooperative_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.cooperative_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id  UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'agronomist',  -- agronomist, viewer
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cooperative_id, user_id)
);

ALTER TABLE public.cooperatives      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_admins  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperative_members ENABLE ROW LEVEL SECURITY;

-- Admins can manage the cooperative
CREATE POLICY "coop_admin_all" ON public.cooperatives
  FOR ALL USING (
    id IN (
      SELECT cooperative_id FROM public.cooperative_admins ca
      JOIN public.users u ON u.id = ca.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY "coop_admin_mgmt" ON public.cooperative_admins
  FOR ALL USING (
    cooperative_id IN (
      SELECT cooperative_id FROM public.cooperative_admins ca2
      JOIN public.users u ON u.id = ca2.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY "coop_member_mgmt" ON public.cooperative_members
  FOR ALL USING (
    cooperative_id IN (
      SELECT cooperative_id FROM public.cooperative_admins ca
      JOIN public.users u ON u.id = ca.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- Members can view their own membership
CREATE POLICY "own_membership_select" ON public.cooperative_members
  FOR SELECT USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_coop_admins_user    ON public.cooperative_admins  (user_id);
CREATE INDEX IF NOT EXISTS idx_coop_members_coop   ON public.cooperative_members (cooperative_id);
CREATE INDEX IF NOT EXISTS idx_coop_members_user   ON public.cooperative_members (user_id);

COMMENT ON TABLE public.cooperatives IS
  'Agricultural cooperatives — enterprise-tier organisations managing multiple agronomist accounts.';
