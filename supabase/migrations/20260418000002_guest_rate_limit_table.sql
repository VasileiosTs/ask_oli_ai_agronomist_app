-- ============================================================
-- Guest rate-limit table: persists per-IP counters across
-- Edge Function isolate restarts and regional instances.
-- Previously the rate limit lived in an in-memory Map which
-- was reset on cold-start, allowing trivial bypass.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.guest_rate_limits (
  ip         TEXT        PRIMARY KEY,
  count      INTEGER     NOT NULL DEFAULT 0,
  reset_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only service role can read/write this table — no client access
ALTER TABLE public.guest_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: RLS-enabled with no policies = deny all authenticated/anon access.
-- Service role bypasses RLS entirely.

COMMENT ON TABLE public.guest_rate_limits IS
  'Per-IP rate limit counters for unauthenticated chat usage. Written exclusively by the chat Edge Function via service role.';
