-- ============================================================
-- Follow-up email notifications (April 2026)
--
-- Uses pg_net to call the Resend API directly from the DB.
-- Requires one-time setup in Supabase SQL editor:
--
--   ALTER DATABASE postgres SET app.resend_api_key = 're_YOUR_KEY_HERE';
--   ALTER DATABASE postgres SET app.resend_from    = 'Oli <noreply@askoli.gr>';
--
-- Get a free Resend API key at resend.com (free tier = 3 000 emails/month).
-- ============================================================

-- 1. Follow-up email function
CREATE OR REPLACE FUNCTION public.send_followup_emails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec        RECORD;
  resend_key text;
  from_addr  text;
  subject_el text := 'Πώς πήγε η επέμβαση;';
  subject_en text := 'How did the intervention go?';
  html_body  text;
BEGIN
  resend_key := current_setting('app.resend_api_key', true);
  from_addr  := coalesce(current_setting('app.resend_from', true), 'Oli <noreply@askoli.gr>');

  -- Skip silently if Resend key not configured
  IF resend_key IS NULL OR resend_key = '' THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT
      u.id           AS user_id,
      au.email,
      coalesce(u.name, '') AS user_name,
      coalesce(u.language, 'el') AS lang,
      i.id           AS intervention_id,
      coalesce(i.problem, i.diagnosis, '') AS problem,
      coalesce(i.product_applied, i.product, '') AS product,
      i.follow_up_at,
      f.name         AS field_name
    FROM   public.interventions i
    JOIN   public.users         u  ON u.id      = i.user_id
    JOIN   auth.users           au ON au.id     = u.auth_id
    LEFT JOIN public.fields     f  ON f.id      = i.field_id
    WHERE  i.follow_up_at  <= now()
      AND  i.followed_up_at IS NULL
      AND  i.outcome        IS NULL
      AND  u.notification_followup = true
      AND  au.email IS NOT NULL
    LIMIT 50
  LOOP
    IF rec.lang = 'el' THEN
      html_body :=
        '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a">'
        || '<div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">'
        || '<svg width="22" height="22" viewBox="0 0 24 24" fill="#2EA043"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-13 6 0 0 .93-.98 2-2z"/></svg>'
        || '<span style="font-size:18px;font-weight:700;color:#2EA043">Oli</span></div>'
        || '<p style="font-size:15px;margin-bottom:12px">Γεια σου <b>' || rec.user_name || '</b>,</p>'
        || '<p style="font-size:14px;color:#333;line-height:1.6;margin-bottom:16px">'
        || 'Θυμάσαι ότι εφάρμοσες'
        || CASE WHEN rec.product <> '' THEN ' <b>' || rec.product || '</b>' ELSE '' END
        || CASE WHEN rec.problem <> '' THEN ' για <b>' || rec.problem || '</b>' ELSE '' END
        || CASE WHEN rec.field_name IS NOT NULL THEN ' στο χωράφι <b>' || rec.field_name || '</b>' ELSE '' END
        || '; Πώς πήγε;</p>'
        || '<p style="font-size:14px;color:#333;line-height:1.6;margin-bottom:24px">'
        || 'Άνοιξε την εφαρμογή για να καταγράψεις το αποτέλεσμα &mdash; βοηθάει και εσένα και τον Oli να μάθει.</p>'
        || '<a href="https://askoli.gr" style="display:inline-block;background:#2EA043;color:#fff;text-decoration:none;padding:12px 24px;border-radius:24px;font-size:14px;font-weight:600">Άνοιξε το Oli →</a>'
        || '<p style="margin-top:32px;font-size:11px;color:#999">Για να σταματήσεις αυτές τις ειδοποιήσεις, άνοιξε το Προφίλ σου στο Oli.</p>'
        || '</div>';

      PERFORM net.http_post(
        url     := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || resend_key, 'Content-Type', 'application/json'),
        body    := jsonb_build_object('from', from_addr, 'to', ARRAY[rec.email], 'subject', subject_el, 'html', html_body)
      );
    ELSE
      html_body :=
        '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a">'
        || '<div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">'
        || '<svg width="22" height="22" viewBox="0 0 24 24" fill="#2EA043"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-13 6 0 0 .93-.98 2-2z"/></svg>'
        || '<span style="font-size:18px;font-weight:700;color:#2EA043">Oli</span></div>'
        || '<p style="font-size:15px;margin-bottom:12px">Hi <b>' || rec.user_name || '</b>,</p>'
        || '<p style="font-size:14px;color:#333;line-height:1.6;margin-bottom:16px">'
        || 'Remember you applied'
        || CASE WHEN rec.product <> '' THEN ' <b>' || rec.product || '</b>' ELSE '' END
        || CASE WHEN rec.problem <> '' THEN ' for <b>' || rec.problem || '</b>' ELSE '' END
        || CASE WHEN rec.field_name IS NOT NULL THEN ' in field <b>' || rec.field_name || '</b>' ELSE '' END
        || '? How did it go?</p>'
        || '<p style="font-size:14px;color:#333;line-height:1.6;margin-bottom:24px">'
        || 'Open the app to log the outcome &mdash; it helps you track progress and helps Oli learn.</p>'
        || '<a href="https://askoli.gr" style="display:inline-block;background:#2EA043;color:#fff;text-decoration:none;padding:12px 24px;border-radius:24px;font-size:14px;font-weight:600">Open Oli →</a>'
        || '<p style="margin-top:32px;font-size:11px;color:#999">To stop these notifications, open your Profile in Oli.</p>'
        || '</div>';

      PERFORM net.http_post(
        url     := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || resend_key, 'Content-Type', 'application/json'),
        body    := jsonb_build_object('from', from_addr, 'to', ARRAY[rec.email], 'subject', subject_en, 'html', html_body)
      );
    END IF;

    -- Mark followed up so we don't send again
    UPDATE public.interventions
    SET    followed_up_at = now()
    WHERE  id = rec.intervention_id;

  END LOOP;
END;
$$;

-- 2. Weekly plan email function
CREATE OR REPLACE FUNCTION public.send_weekly_plan_emails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec        RECORD;
  resend_key text;
  from_addr  text;
  html_body  text;
BEGIN
  resend_key := current_setting('app.resend_api_key', true);
  from_addr  := coalesce(current_setting('app.resend_from', true), 'Oli <noreply@askoli.gr>');

  IF resend_key IS NULL OR resend_key = '' THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT
      u.id   AS user_id,
      au.email,
      coalesce(u.name, '') AS user_name,
      coalesce(u.language, 'el') AS lang,
      coalesce(u.primary_crop, '') AS crop,
      coalesce(u.location, '') AS location
    FROM   public.users u
    JOIN   auth.users   au ON au.id = u.auth_id
    WHERE  u.notification_weekly_plan = true
      AND  au.email IS NOT NULL
    LIMIT 200
  LOOP
    IF rec.lang = 'el' THEN
      html_body :=
        '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a">'
        || '<div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">'
        || '<svg width="22" height="22" viewBox="0 0 24 24" fill="#2EA043"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-13 6 0 0 .93-.98 2-2z"/></svg>'
        || '<span style="font-size:18px;font-weight:700;color:#2EA043">Oli</span></div>'
        || '<p style="font-size:15px;margin-bottom:12px">Γεια σου <b>' || rec.user_name || '</b>,</p>'
        || '<p style="font-size:14px;color:#333;line-height:1.6;margin-bottom:24px">'
        || 'Καλή εβδομάδα! Ρώτα τον Oli για τον εβδομαδιαίο σου αγρονομικό πρόγραμμα'
        || CASE WHEN rec.crop <> '' THEN ' για <b>' || rec.crop || '</b>' ELSE '' END
        || '.</p>'
        || '<a href="https://askoli.gr" style="display:inline-block;background:#2EA043;color:#fff;text-decoration:none;padding:12px 24px;border-radius:24px;font-size:14px;font-weight:600">Άνοιξε το Oli →</a>'
        || '<p style="margin-top:32px;font-size:11px;color:#999">Για να σταματήσεις αυτές τις ειδοποιήσεις, άνοιξε το Προφίλ σου στο Oli.</p>'
        || '</div>';

      PERFORM net.http_post(
        url     := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || resend_key, 'Content-Type', 'application/json'),
        body    := jsonb_build_object('from', from_addr, 'to', ARRAY[rec.email], 'subject', 'Εβδομαδιαίο πλάνο από τον Oli 🌱', 'html', html_body)
      );
    ELSE
      html_body :=
        '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a">'
        || '<div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">'
        || '<svg width="22" height="22" viewBox="0 0 24 24" fill="#2EA043"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-13 6 0 0 .93-.98 2-2z"/></svg>'
        || '<span style="font-size:18px;font-weight:700;color:#2EA043">Oli</span></div>'
        || '<p style="font-size:15px;margin-bottom:12px">Hi <b>' || rec.user_name || '</b>,</p>'
        || '<p style="font-size:14px;color:#333;line-height:1.6;margin-bottom:24px">'
        || 'Good week ahead! Ask Oli for your weekly agronomic plan'
        || CASE WHEN rec.crop <> '' THEN ' for <b>' || rec.crop || '</b>' ELSE '' END
        || '.</p>'
        || '<a href="https://askoli.gr" style="display:inline-block;background:#2EA043;color:#fff;text-decoration:none;padding:12px 24px;border-radius:24px;font-size:14px;font-weight:600">Open Oli →</a>'
        || '<p style="margin-top:32px;font-size:11px;color:#999">To stop these notifications, open your Profile in Oli.</p>'
        || '</div>';

      PERFORM net.http_post(
        url     := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || resend_key, 'Content-Type', 'application/json'),
        body    := jsonb_build_object('from', from_addr, 'to', ARRAY[rec.email], 'subject', 'Your weekly plan from Oli 🌱', 'html', html_body)
      );
    END IF;
  END LOOP;
END;
$$;

-- 3. Schedule both via pg_cron
--    Follow-up check: every day at 08:00 UTC
--    Weekly plan:     every Monday at 07:00 UTC
SELECT cron.schedule('oli-followup-emails',  '0 8 * * *',   'SELECT public.send_followup_emails();');
SELECT cron.schedule('oli-weekly-plan-emails','0 7 * * 1',  'SELECT public.send_weekly_plan_emails();');
