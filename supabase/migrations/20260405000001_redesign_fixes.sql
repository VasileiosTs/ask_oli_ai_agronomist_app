-- ============================================================
-- Migration: 20260405000001_redesign_fixes.sql
--
-- Covers all schema changes required by the redesigned files:
--   1. Greeting cache columns on users
--   2. Memory snapshot retention trigger (max 100 per field)
--   3. outcome_note column on interventions (already exists per
--      20260321000000 — documented here for completeness)
--   4. vio_step column ensures it's present with a default
-- ============================================================

-- ── 1. Greeting cache ──────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_greeting     TEXT,
  ADD COLUMN IF NOT EXISTS last_greeting_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.users.last_greeting    IS 'Last AI-generated greeting text, cached for 24 h to avoid cold-start on every app open.';
COMMENT ON COLUMN public.users.last_greeting_at IS 'When last_greeting was generated. Used to determine cache staleness.';


-- ── 2. Memory snapshot retention trigger ──────────────────
-- Deletes the oldest snapshot for a field when the per-field count
-- exceeds 100, keeping storage costs bounded without a cron job.

CREATE OR REPLACE FUNCTION public.trim_memory_snapshots()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_count  INTEGER;
  v_max    INTEGER := 100;
BEGIN
  IF NEW.field_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.memory_snapshots
   WHERE field_id = NEW.field_id;

  IF v_count > v_max THEN
    DELETE FROM public.memory_snapshots
     WHERE id IN (
       SELECT id FROM public.memory_snapshots
        WHERE field_id = NEW.field_id
        ORDER BY created_at ASC
        LIMIT (v_count - v_max)
     );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trim_memory_snapshots ON public.memory_snapshots;
CREATE TRIGGER trg_trim_memory_snapshots
  AFTER INSERT ON public.memory_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.trim_memory_snapshots();


-- ── 3. outcome_note (added in 20260321000000 — verify exists) ──
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS outcome_note TEXT;

COMMENT ON COLUMN public.interventions.outcome_note IS 'Free-text farmer observation entered after recording outcome chip (Better/Same/Worse/Not applied). Primary qualitative VIO signal.';


-- ── 4. outcome_at timestamp ────────────────────────────────
-- Records when the outcome chip was tapped, enabling time-to-outcome analytics.
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS outcome_at TIMESTAMPTZ;

COMMENT ON COLUMN public.interventions.outcome_at IS 'When the farmer recorded the treatment outcome.';


-- ── 5. vio_step default ────────────────────────────────────
ALTER TABLE public.interventions
  ALTER COLUMN vio_step SET DEFAULT 0;


-- ── 6. Indexes ─────────────────────────────────────────────
-- Speed up the cache-column read on every app open.
CREATE INDEX IF NOT EXISTS idx_users_auth_id_greeting
  ON public.users (auth_id)
  INCLUDE (last_greeting, last_greeting_at);

-- Speed up the memory snapshot trim query.
CREATE INDEX IF NOT EXISTS idx_memory_snapshots_field_created
  ON public.memory_snapshots (field_id, created_at ASC);
