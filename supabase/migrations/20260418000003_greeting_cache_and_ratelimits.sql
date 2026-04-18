-- ============================================================
-- greeting_cache: persists per-user greeting so the greeting
-- Edge Function skips Gemini calls within the 10-min cooldown.
-- Prevents authenticated users from burning Gemini quota.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.greeting_cache (
  auth_id      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  greeting     TEXT        NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only the owner can read their own greeting; service role writes
ALTER TABLE public.greeting_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "greeting_cache_own_select" ON public.greeting_cache
  FOR SELECT USING (auth_id = auth.uid());

-- Writes done exclusively by the greeting Edge Function via service role
-- (service role bypasses RLS — no INSERT policy needed for clients)

-- ============================================================
-- og_image_rate_limits: per-IP counter for the og-image function.
-- Prevents cheap DoS / egress abuse on the unauthenticated endpoint.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.og_image_rate_limits (
  ip         TEXT        PRIMARY KEY,
  count      INTEGER     NOT NULL DEFAULT 0,
  reset_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.og_image_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: deny all client access; Edge Function uses service role.

COMMENT ON TABLE public.og_image_rate_limits IS
  'Per-IP hourly request counters for the og-image Edge Function.';
