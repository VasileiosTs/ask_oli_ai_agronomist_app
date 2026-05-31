-- ═══════════════════════════════════════════════════════════════════
-- Fix: manual admin grants now auto-expire when tier_expires_at is set
-- ───────────────────────────────────────────────────────────────────
-- expire_promo_tiers() previously only covered tier_source IN ('promo','trial').
-- Admin grants (tier_source = 'manual') with a tier_expires_at date were never
-- downgraded, effectively becoming permanent.
--
-- Design intent (confirmed):
--   If admin sets tier_expires_at → grant expires on that date
--   If admin leaves tier_expires_at NULL → grant is unlimited (unchanged)
--
-- The existing WHERE clause already requires `tier_expires_at IS NOT NULL`,
-- so unlimited grants (no date) are unaffected by adding 'manual'.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.expire_promo_tiers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.users
     SET tier                   = 'free',
         tier_expires_at        = NULL,
         tier_source            = NULL,
         expiry_warned_at       = NULL,
         expiry_final_warned_at = NULL,
         expiry_post_warned_at  = NULL,
         tier_expired_at        = now(),
         updated_at             = now()
   WHERE tier_source IN ('promo', 'trial', 'manual')   -- 'manual' added: admin grants with a date now expire
     AND tier_expires_at IS NOT NULL
     AND tier_expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    INSERT INTO public.operational_events(source, event_type, severity, message, metadata)
    VALUES ('promo_expiry_cron', 'tier_downgraded', 'info',
            'Promo/trial/manual tiers expired and downgraded to free',
            jsonb_build_object('count', v_count));
  END IF;

  RETURN v_count;
END $$;
