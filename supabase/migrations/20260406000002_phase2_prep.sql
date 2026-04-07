-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 prep: data columns for future model training and routing
--
-- These columns are written now so the training data pipeline is ready when
-- we move to a fine-tuned disease model (Phase 2):
--
--   interventions.confidence_score   — AI confidence at time of diagnosis.
--     Lets us filter training data by quality: only VIO outcomes from
--     high-confidence diagnoses (>85) are used to train the vision model.
--
--   chat_messages.ai_model_version   — Which Gemini model produced this message.
--     Tracks "gemini-2.5-flash" vs "gemini-1.5-flash" (fallback) vs future
--     fine-tuned model IDs. Critical for A/B comparison across model versions.
-- ─────────────────────────────────────────────────────────────────────────────

-- confidence_score: 0–100, null for non-diagnosis messages / manual interventions
ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100);

-- ai_model_version: the model ID string from the Gemini API response
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS ai_model_version TEXT;

-- Index for querying high-confidence VIO outcomes (future training data export)
CREATE INDEX IF NOT EXISTS idx_interventions_confidence
  ON interventions (confidence_score)
  WHERE confidence_score IS NOT NULL;

-- Index for comparing outcomes per model version
CREATE INDEX IF NOT EXISTS idx_chat_messages_model
  ON chat_messages (ai_model_version)
  WHERE ai_model_version IS NOT NULL;

COMMENT ON COLUMN interventions.confidence_score IS
  'AI confidence score (0-100) at time of diagnosis. Used to filter training data quality for Phase 2 fine-tuned model. Only interventions with score >85 are used in training.';

COMMENT ON COLUMN chat_messages.ai_model_version IS
  'Gemini model ID that generated this assistant message (e.g. gemini-2.5-flash-preview-04-17). Enables A/B analysis across model versions.';
