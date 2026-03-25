-- ============================================================
-- FEATURES V2: Analytics, VIO multi-step, feedback, push, referrals
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. FEEDBACK on AI responses (thumbs up/down)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS feedback TEXT
  CHECK (feedback IN ('positive', 'negative'));

-- 2. VIO MULTI-STEP follow-up
-- New columns for the multi-step flow:
--   step 1: "Did you apply the treatment?" (2-3 days after logging)
--   step 2: "Any improvements?" (2-3 days after confirmation)
--   step 3: "Final check" (7 days after step 2 = ~13 days total)
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS vio_step INTEGER DEFAULT 0;
  -- 0 = logged, no follow-up scheduled
  -- 1 = waiting for "did you apply?" (follow_up_at set to +3 days)
  -- 2 = applied, waiting for "improvements?" (follow_up_at set to +3 more days)
  -- 3 = complete (outcome recorded)
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS applied_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS improvement_note TEXT;

-- Update existing interventions: those with follow_up_at but no vio_step → set to step 1
UPDATE interventions
  SET vio_step = 1
  WHERE follow_up_at IS NOT NULL
    AND outcome IS NULL
    AND vio_step IS NULL;

-- 3. PUSH SUBSCRIPTIONS for web push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_push_subs" ON push_subscriptions;
CREATE POLICY "users_own_push_subs" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- 4. REFERRAL TRACKING
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_share_id UUID;

-- 5. Efficient index for multi-step VIO queries
DROP INDEX IF EXISTS idx_interventions_vio_pending;
CREATE INDEX idx_interventions_vio_pending
  ON interventions (follow_up_at, vio_step)
  WHERE follow_up_at IS NOT NULL
    AND outcome IS NULL
    AND vio_step < 3;

-- 6. Index for feedback analytics
CREATE INDEX IF NOT EXISTS idx_chat_messages_feedback
  ON chat_messages (feedback)
  WHERE feedback IS NOT NULL;
