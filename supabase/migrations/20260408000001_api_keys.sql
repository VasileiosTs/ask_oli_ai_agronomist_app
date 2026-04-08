-- ─────────────────────────────────────────────────────────────────────────────
-- API keys table for Oli public API (v1)
--
-- Scope: agronomist and enterprise users can generate API keys to integrate
-- Oli diagnoses into their own tools (mobile apps, precision-ag dashboards,
-- advisory portals).  Each key is scoped to a single user account and is
-- hashed before storage (SHA-256 hex) so a DB breach doesn't expose live keys.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_keys (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,                    -- human label e.g. "My app"
  key_hash      TEXT        NOT NULL UNIQUE,             -- SHA-256(raw_key) hex
  key_prefix    TEXT        NOT NULL,                    -- first 8 chars of raw key shown in UI
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ                              -- null = active
);

-- Only the key owner can read their keys
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON public.api_keys
  FOR SELECT USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "owner_insert" ON public.api_keys
  FOR INSERT WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "owner_update" ON public.api_keys
  FOR UPDATE USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- Fast lookup by hash (used on every API request)
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys (key_hash)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.api_keys IS
  'API keys for Oli public API v1. Keys are stored as SHA-256 hashes only.';
