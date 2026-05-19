-- ═══════════════════════════════════════════════════════════════════
-- KPI: Accurate tier breakdown — fix paying_users & MRR
-- ═══════════════════════════════════════════════════════════════════
--
-- Problems with the original:
--   1. paying_users counted everyone with tier='pro' — includes trial users
--   2. MRR was hardcoded to 0 (never updated when Stripe landed)
--   3. No split between free / trial / promo / real-paid users
--
-- Changes:
--   1. Add trial_users, promo_users, free_users columns
--   2. paying_users → only tier_source = 'stripe'
--   3. mrr_cents → pro_stripe * 499 + master_stripe * 4900
--      (monthly equivalent; yearly subscribers approximated at monthly rate)

ALTER TABLE public.kpi_snapshots
  ADD COLUMN IF NOT EXISTS trial_users  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_users  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_users   integer NOT NULL DEFAULT 0;

-- ── Replace the compute function with fixed revenue logic ──────────

CREATE OR REPLACE FUNCTION public.compute_kpi_snapshot(target_date date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  v_total_users integer;
  v_new_today integer;
  v_new_week integer;
  v_new_month integer;
  v_dau integer;
  v_wau integer;
  v_mau integer;
  v_activation numeric;
  v_onboarding numeric;
  v_avg_msg numeric;
  v_msg_today integer;
  v_photos_today integer;
  v_total_convos integer;
  v_avg_convos numeric;
  v_vio_logged integer;
  v_vio_completed integer;
  v_vio_rate numeric;
  v_ret_d1 numeric;
  v_ret_d7 numeric;
  v_ret_d30 numeric;
  v_paying integer;
  v_trial integer;
  v_promo integer;
  v_free integer;
  v_mrr integer;
  v_churned integer;
  v_users_photos integer;
  v_users_fields integer;
  v_users_interventions integer;
  v_positive_fb integer;
  v_negative_fb integer;
BEGIN
  -- ── USER COUNTS ──
  SELECT count(*) INTO v_total_users FROM users;

  SELECT count(*) INTO v_new_today
  FROM users WHERE created_at::date = target_date;

  SELECT count(*) INTO v_new_week
  FROM users WHERE created_at >= (target_date - interval '7 days');

  SELECT count(*) INTO v_new_month
  FROM users WHERE created_at >= (target_date - interval '30 days');

  -- ── ACTIVE USERS (based on messages sent) ──
  SELECT count(DISTINCT user_id) INTO v_dau
  FROM chat_messages WHERE role = 'user' AND created_at::date = target_date;

  SELECT count(DISTINCT user_id) INTO v_wau
  FROM chat_messages WHERE role = 'user' AND created_at >= (target_date - interval '7 days');

  SELECT count(DISTINCT user_id) INTO v_mau
  FROM chat_messages WHERE role = 'user' AND created_at >= (target_date - interval '30 days');

  -- ── ACTIVATION (% of users who sent first msg within 24h of signup) ──
  SELECT COALESCE(
    ROUND(
      100.0 * count(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM chat_messages cm
          WHERE cm.user_id = u.id
            AND cm.role = 'user'
            AND cm.created_at <= u.created_at + interval '24 hours'
        )
      ) / NULLIF(count(*), 0),
      2
    ),
    0
  ) INTO v_activation
  FROM users u
  WHERE u.created_at >= (target_date - interval '30 days');

  -- ── ONBOARDING COMPLETION ──
  SELECT COALESCE(
    ROUND(100.0 * count(*) FILTER (WHERE onboarding_complete) / NULLIF(count(*), 0), 2),
    0
  ) INTO v_onboarding FROM users;

  -- ── ENGAGEMENT ──
  SELECT count(*) INTO v_msg_today
  FROM chat_messages WHERE role = 'user' AND created_at::date = target_date;

  SELECT count(*) INTO v_photos_today
  FROM chat_messages
  WHERE role = 'user' AND created_at::date = target_date
    AND array_length(image_urls, 1) > 0;

  SELECT COALESCE(ROUND(v_msg_today::numeric / NULLIF(v_dau, 0), 2), 0) INTO v_avg_msg;

  SELECT count(*) INTO v_total_convos FROM conversations;

  SELECT COALESCE(ROUND(count(*)::numeric / NULLIF(v_total_users, 0), 2), 0)
  INTO v_avg_convos FROM conversations;

  -- ── VIO FUNNEL ──
  SELECT count(*) INTO v_vio_logged FROM interventions;

  SELECT count(*) INTO v_vio_completed
  FROM interventions WHERE outcome IS NOT NULL;

  SELECT COALESCE(
    ROUND(100.0 * v_vio_completed / NULLIF(v_vio_logged, 0), 2), 0
  ) INTO v_vio_rate;

  -- ── RETENTION (cohort-based) ──
  SELECT COALESCE(
    ROUND(100.0 * count(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM chat_messages cm
        WHERE cm.user_id = u.id AND cm.role = 'user'
          AND cm.created_at::date = u.created_at::date + 1
      )
    ) / NULLIF(count(*), 0), 2),
    0
  ) INTO v_ret_d1
  FROM users u WHERE u.created_at::date = target_date - 1;

  SELECT COALESCE(
    ROUND(100.0 * count(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM chat_messages cm
        WHERE cm.user_id = u.id AND cm.role = 'user'
          AND cm.created_at::date = u.created_at::date + 7
      )
    ) / NULLIF(count(*), 0), 2),
    0
  ) INTO v_ret_d7
  FROM users u WHERE u.created_at::date = target_date - 7;

  SELECT COALESCE(
    ROUND(100.0 * count(*) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM chat_messages cm
        WHERE cm.user_id = u.id AND cm.role = 'user'
          AND cm.created_at::date = u.created_at::date + 30
      )
    ) / NULLIF(count(*), 0), 2),
    0
  ) INTO v_ret_d30
  FROM users u WHERE u.created_at::date = target_date - 30;

  -- ── REVENUE (fixed) ─────────────────────────────────────────────
  -- paying_users: only real Stripe subscribers (not trial, not promo)
  SELECT count(*) INTO v_paying
  FROM users WHERE tier_source = 'stripe';

  -- trial_users: 30-day free Pro trial
  SELECT count(*) INTO v_trial
  FROM users WHERE tier_source = 'trial';

  -- promo_users: promo-code access
  SELECT count(*) INTO v_promo
  FROM users WHERE tier_source = 'promo';

  -- free_users: no tier or explicitly free
  SELECT count(*) INTO v_free
  FROM users WHERE tier IS NULL OR tier = 'free';

  -- MRR in cents: Pro €4.99 + Master €49 (monthly equivalent)
  -- Yearly subscribers appear here at their monthly rate (slight overcount,
  -- acceptable until we pull exact amounts from Stripe invoice data).
  SELECT
    COALESCE(count(*) FILTER (WHERE tier = 'pro'), 0)        * 499  +
    COALESCE(count(*) FILTER (WHERE tier = 'master'), 0)     * 4900 +
    COALESCE(count(*) FILTER (WHERE tier = 'enterprise'), 0) * 0    -- enterprise is custom
  INTO v_mrr
  FROM users WHERE tier_source = 'stripe';

  -- ── CHURN (users active 31-60 days ago but NOT in last 30 days) ──
  SELECT count(*) INTO v_churned
  FROM (
    SELECT DISTINCT user_id FROM chat_messages
    WHERE role = 'user'
      AND created_at::date BETWEEN (target_date - 60) AND (target_date - 31)
  ) old_active
  WHERE NOT EXISTS (
    SELECT 1 FROM chat_messages cm
    WHERE cm.user_id = old_active.user_id
      AND cm.role = 'user'
      AND cm.created_at >= (target_date - interval '30 days')
  );

  -- ── FEATURE ADOPTION ──
  SELECT count(DISTINCT user_id) INTO v_users_photos
  FROM chat_messages WHERE array_length(image_urls, 1) > 0;

  SELECT count(DISTINCT user_id) INTO v_users_fields FROM fields;

  SELECT count(DISTINCT user_id) INTO v_users_interventions FROM interventions;

  -- ── FEEDBACK ──
  SELECT
    count(*) FILTER (WHERE metadata->>'feedback' = 'positive'),
    count(*) FILTER (WHERE metadata->>'feedback' = 'negative')
  INTO v_positive_fb, v_negative_fb
  FROM chat_messages WHERE metadata->>'feedback' IS NOT NULL;

  -- ── INSERT SNAPSHOT ──
  INSERT INTO kpi_snapshots (
    snapshot_date,
    total_users, new_users_today, new_users_week, new_users_month,
    dau, wau, mau,
    activation_rate_24h, onboarding_completion_rate,
    avg_messages_per_active_user, total_messages_today, total_photos_today,
    total_conversations, avg_conversations_per_user,
    vio_logged_count, vio_completed_count, vio_completion_rate,
    retention_d1, retention_d7, retention_d30,
    paying_users, trial_users, promo_users, free_users, mrr_cents,
    churned_users_30d,
    users_with_photos, users_with_fields, users_with_interventions,
    positive_feedback_count, negative_feedback_count
  ) VALUES (
    target_date,
    v_total_users, v_new_today, v_new_week, v_new_month,
    v_dau, v_wau, v_mau,
    v_activation, v_onboarding,
    v_avg_msg, v_msg_today, v_photos_today,
    v_total_convos, v_avg_convos,
    v_vio_logged, v_vio_completed, v_vio_rate,
    v_ret_d1, v_ret_d7, v_ret_d30,
    v_paying, v_trial, v_promo, v_free, v_mrr,
    v_churned,
    v_users_photos, v_users_fields, v_users_interventions,
    v_positive_fb, v_negative_fb
  )
  ON CONFLICT (snapshot_date) DO UPDATE SET
    total_users = EXCLUDED.total_users,
    new_users_today = EXCLUDED.new_users_today,
    new_users_week = EXCLUDED.new_users_week,
    new_users_month = EXCLUDED.new_users_month,
    dau = EXCLUDED.dau, wau = EXCLUDED.wau, mau = EXCLUDED.mau,
    activation_rate_24h = EXCLUDED.activation_rate_24h,
    onboarding_completion_rate = EXCLUDED.onboarding_completion_rate,
    avg_messages_per_active_user = EXCLUDED.avg_messages_per_active_user,
    total_messages_today = EXCLUDED.total_messages_today,
    total_photos_today = EXCLUDED.total_photos_today,
    total_conversations = EXCLUDED.total_conversations,
    avg_conversations_per_user = EXCLUDED.avg_conversations_per_user,
    vio_logged_count = EXCLUDED.vio_logged_count,
    vio_completed_count = EXCLUDED.vio_completed_count,
    vio_completion_rate = EXCLUDED.vio_completion_rate,
    retention_d1 = EXCLUDED.retention_d1,
    retention_d7 = EXCLUDED.retention_d7,
    retention_d30 = EXCLUDED.retention_d30,
    paying_users = EXCLUDED.paying_users,
    trial_users  = EXCLUDED.trial_users,
    promo_users  = EXCLUDED.promo_users,
    free_users   = EXCLUDED.free_users,
    mrr_cents = EXCLUDED.mrr_cents,
    churned_users_30d = EXCLUDED.churned_users_30d,
    users_with_photos = EXCLUDED.users_with_photos,
    users_with_fields = EXCLUDED.users_with_fields,
    users_with_interventions = EXCLUDED.users_with_interventions,
    positive_feedback_count = EXCLUDED.positive_feedback_count,
    negative_feedback_count = EXCLUDED.negative_feedback_count,
    created_at = now();

  SELECT to_jsonb(k.*) INTO result
  FROM kpi_snapshots k WHERE k.snapshot_date = target_date;

  RETURN result;
END;
$$;
