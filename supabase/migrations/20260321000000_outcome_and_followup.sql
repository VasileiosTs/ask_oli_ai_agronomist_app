-- Migration: outcome recording support
-- Safe to re-run (IF NOT EXISTS guards)

-- Ensure interventions has outcome fields
ALTER TABLE public.interventions ADD COLUMN IF NOT EXISTS outcome TEXT
  CHECK (outcome IN ('better', 'same', 'worse'));
ALTER TABLE public.interventions ADD COLUMN IF NOT EXISTS outcome_note TEXT;
ALTER TABLE public.interventions ADD COLUMN IF NOT EXISTS outcome_recorded_at TIMESTAMPTZ;
ALTER TABLE public.interventions ADD COLUMN IF NOT EXISTS outcome_image_path TEXT;

-- Index for follow-up queries (find overdue follow-ups efficiently)
CREATE INDEX IF NOT EXISTS idx_interventions_followup_pending
  ON public.interventions (follow_up_at)
  WHERE follow_up_at IS NOT NULL
    AND followed_up_at IS NULL
    AND outcome IS NULL;
