// Oli Email Edge Function
// Sends transactional emails via Resend API
// Modes: welcome, vio_reminder, weekly_digest, custom

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// CRON_SECRET allows pg_cron to call cron modes without service role key in git history.
// Set CRON_SECRET in Supabase Edge Function secrets (same value used in migration).
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Oli <noreply@ask-oli.com>";
const APP_URL = Deno.env.get("APP_URL") || "https://ask-oli.com";
const SUPPORT_EMAIL = Deno.env.get("SUPPORT_EMAIL") || "hello@ask-oli.com";

// ── CORS ──
const ALLOWED_ORIGIN =
  Deno.env.get("ALLOWED_ORIGIN") || "https://ask-oli.com";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const isAllowed =
    origin === ALLOWED_ORIGIN ||
    origin === "http://localhost:5173" ||
    origin === "http://localhost:3000" ||
    origin === "http://127.0.0.1:3000";
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ── Email validation ──
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string): boolean {
  return typeof email === "string" && EMAIL_REGEX.test(email) && email.length <= 254;
}

async function listAllAuthUsers(supabase: ReturnType<typeof createClient>) {
  const allUsers: Array<{ id: string; email?: string | null }> = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("Failed to list auth users:", error);
      break;
    }

    const batch = data?.users ?? [];
    allUsers.push(...batch.map((user) => ({ id: user.id, email: user.email })));

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return allUsers;
}

// ── Send via Resend ──
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Email send error:", e);
    return false;
  }
}

// ── Email Templates ──

function welcomeEmail(name: string, lang: string): { subject: string; html: string } {
  const isEl = lang === "el";
  return {
    subject: isEl ? "Καλώς ήρθες στο Oli! 🌱" : "Welcome to Oli! 🌱",
    html: `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <tr><td style="text-align:center;padding-bottom:24px;">
      <span style="font-size:28px;font-weight:700;color:#194121;">🌱 Oli</span>
    </td></tr>
    <tr><td style="background:#fff;border-radius:16px;padding:32px;border:1px solid #e8e5dc;">
      <h1 style="margin:0 0 12px;font-size:22px;color:#1a1a1a;">
        ${isEl ? `Γεια σου ${name}!` : `Hi ${name}!`}
      </h1>
      <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">
        ${isEl
          ? "Ο Oli είναι ο AI γεωπόνος σου — πάντα δίπλα σου για διαγνώσεις, συμβουλές ψεκασμού και παρακολούθηση παρεμβάσεων."
          : "Oli is your AI agronomist — always here for crop diagnosis, spray advice, and intervention tracking."
        }
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
        ${isEl ? "Ξεκίνα στέλνοντας μια φωτογραφία ή ρωτώντας οτιδήποτε:" : "Get started by sending a photo or asking anything:"}
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr><td style="background:#194121;border-radius:12px;padding:14px 32px;">
          <a href="${APP_URL}/chat" style="color:#fff;text-decoration:none;font-weight:600;font-size:15px;">
            ${isEl ? "Άνοιξε τον Oli →" : "Open Oli →"}
          </a>
        </td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#999;line-height:1.5;">
        ${isEl
          ? "Μπορείς επίσης να εγκαταστήσεις το Oli ως εφαρμογή στο κινητό σου από το browser."
          : "You can also install Oli as an app on your phone from your browser."
        }
      </p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:24px;">
      <p style="font-size:12px;color:#999;">
        ${isEl ? "Αυτό το email στάλθηκε από το Oli" : "This email was sent by Oli"}
        · <a href="${APP_URL}/legal/privacy" style="color:#999;">Privacy</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

function vioReminderEmail(
  name: string,
  problem: string,
  step: number,
  lang: string
): { subject: string; html: string } {
  const isEl = lang === "el";
  const stepMsg = step <= 1
    ? (isEl ? `Εφάρμοσες τη θεραπεία για "${problem}";` : `Did you apply the treatment for "${problem}"?`)
    : (isEl ? `Βλέπεις βελτίωση στο "${problem}";` : `Any improvement with "${problem}"?`);

  return {
    subject: isEl ? `Oli: ${stepMsg}` : `Oli: ${stepMsg}`,
    html: `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <tr><td style="text-align:center;padding-bottom:24px;">
      <span style="font-size:28px;font-weight:700;color:#194121;">🌱 Oli</span>
    </td></tr>
    <tr><td style="background:#fff;border-radius:16px;padding:32px;border:1px solid #e8e5dc;">
      <h1 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">
        ${isEl ? `${name}, ` : `${name}, `}${stepMsg}
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
        ${isEl
          ? "Ανοίξε τον Oli για να καταγράψεις το αποτέλεσμα. Αυτό βοηθάει τον Oli να σου δίνει καλύτερες συμβουλές."
          : "Open Oli to record the outcome. This helps Oli give you better advice in the future."
        }
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr><td style="background:#194121;border-radius:12px;padding:14px 32px;">
          <a href="${APP_URL}/chat" style="color:#fff;text-decoration:none;font-weight:600;font-size:15px;">
            ${isEl ? "Άνοιξε τον Oli →" : "Open Oli →"}
          </a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="text-align:center;padding-top:24px;">
      <p style="font-size:12px;color:#999;">
        <a href="${APP_URL}/profile" style="color:#999;">${isEl ? "Ρυθμίσεις ειδοποιήσεων" : "Notification settings"}</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

function weeklyDigestEmail(
  name: string,
  stats: { messages: number; interventions: number; outcomes: number; pendingVio: number },
  lang: string
): { subject: string; html: string } {
  const isEl = lang === "el";
  const week = new Date().toLocaleDateString(isEl ? "el" : "en", { month: "short", day: "numeric" });

  return {
    subject: isEl ? `Oli: Η εβδομάδα σου (${week})` : `Oli: Your week (${week})`,
    html: `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <tr><td style="text-align:center;padding-bottom:24px;">
      <span style="font-size:28px;font-weight:700;color:#194121;">🌱 Oli</span>
    </td></tr>
    <tr><td style="background:#fff;border-radius:16px;padding:32px;border:1px solid #e8e5dc;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#1a1a1a;">
        ${isEl ? `${name}, η εβδομάδα σου` : `${name}, your week`}
      </h1>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="width:50%;padding:12px;text-align:center;background:#f9f8f4;border-radius:12px 0 0 0;">
            <div style="font-size:28px;font-weight:700;color:#194121;">${stats.messages}</div>
            <div style="font-size:12px;color:#888;margin-top:4px;">${isEl ? "Μηνύματα" : "Messages"}</div>
          </td>
          <td style="width:50%;padding:12px;text-align:center;background:#f9f8f4;border-radius:0 12px 0 0;">
            <div style="font-size:28px;font-weight:700;color:#194121;">${stats.interventions}</div>
            <div style="font-size:12px;color:#888;margin-top:4px;">${isEl ? "Παρεμβάσεις" : "Interventions"}</div>
          </td>
        </tr>
        <tr>
          <td style="width:50%;padding:12px;text-align:center;background:#f9f8f4;border-radius:0 0 0 12px;">
            <div style="font-size:28px;font-weight:700;color:#194121;">${stats.outcomes}</div>
            <div style="font-size:12px;color:#888;margin-top:4px;">${isEl ? "Αποτελέσματα" : "Outcomes"}</div>
          </td>
          <td style="width:50%;padding:12px;text-align:center;background:#f9f8f4;border-radius:0 0 12px 0;">
            <div style="font-size:28px;font-weight:700;color:${stats.pendingVio > 0 ? '#d97706' : '#194121'};">${stats.pendingVio}</div>
            <div style="font-size:12px;color:#888;margin-top:4px;">${isEl ? "Εκκρεμή VIO" : "Pending VIO"}</div>
          </td>
        </tr>
      </table>
      ${stats.pendingVio > 0 ? `
      <p style="margin:0 0 24px;font-size:14px;color:#d97706;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;">
        ${isEl
          ? `Έχεις ${stats.pendingVio} παρεμβάσεις που περιμένουν αποτέλεσμα. Άνοιξε τον Oli!`
          : `You have ${stats.pendingVio} interventions awaiting outcome. Open Oli!`
        }
      </p>` : ""}
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr><td style="background:#194121;border-radius:12px;padding:14px 32px;">
          <a href="${APP_URL}/chat" style="color:#fff;text-decoration:none;font-weight:600;font-size:15px;">
            ${isEl ? "Άνοιξε τον Oli →" : "Open Oli →"}
          </a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="text-align:center;padding-top:24px;">
      <p style="font-size:12px;color:#999;">
        <a href="${APP_URL}/profile" style="color:#999;">${isEl ? "Ρυθμίσεις ειδοποιήσεων" : "Notification settings"}</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

function onboardingDripEmail(
  name: string,
  day: number,
  lang: string
): { subject: string; html: string } {
  const isEl = lang === "el";

  const content = day <= 3
    ? {
        subject: isEl ? "Ήξερες ότι ο Oli αναγνωρίζει 200+ ασθένειες;" : "Did you know Oli detects 200+ diseases?",
        heading: isEl ? `${name}, δοκίμασε τη φωτο-διάγνωση!` : `${name}, try photo diagnosis!`,
        body: isEl
          ? "Στείλε μια φωτογραφία της καλλιέργειάς σου και πάρε άμεση διάγνωση με σύσταση θεραπείας. Ο Oli αναγνωρίζει πάνω από 200 ασθένειες και παράσιτα."
          : "Send a photo of your crop and get instant diagnosis with treatment advice. Oli detects over 200 diseases and pests.",
        cta: isEl ? "Στείλε φωτογραφία →" : "Send a photo →",
      }
    : {
        subject: isEl ? "Ο Oli σε περιμένει — δωρεάν ακόμα!" : "Oli is waiting — still free!",
        heading: isEl ? `${name}, μη χάσεις τις δωρεάν ερωτήσεις σου!` : `${name}, don't miss your free questions!`,
        body: isEl
          ? "Έχεις 20 δωρεάν ερωτήσεις κάθε μήνα. Ρώτησε τον Oli για ψεκασμούς, λίπανση, ή ό,τι αφορά τις καλλιέργειές σου."
          : "You have 20 free questions every month. Ask Oli about spraying, fertilization, or anything about your crops.",
        cta: isEl ? "Ρώτα τον Oli →" : "Ask Oli →",
      };

  return {
    subject: content.subject,
    html: `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <tr><td style="text-align:center;padding-bottom:24px;">
      <span style="font-size:28px;font-weight:700;color:#194121;">🌱 Oli</span>
    </td></tr>
    <tr><td style="background:#fff;border-radius:16px;padding:32px;border:1px solid #e8e5dc;">
      <h1 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">${content.heading}</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">${content.body}</p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr><td style="background:#194121;border-radius:12px;padding:14px 32px;">
          <a href="${APP_URL}/chat" style="color:#fff;text-decoration:none;font-weight:600;font-size:15px;">${content.cta}</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="text-align:center;padding-top:24px;">
      <p style="font-size:12px;color:#999;">
        <a href="${APP_URL}/profile" style="color:#999;">${isEl ? "Ρυθμίσεις ειδοποιήσεων" : "Notification settings"}</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

function reEngagementEmail(
  name: string,
  lang: string
): { subject: string; html: string } {
  const isEl = lang === "el";
  return {
    subject: isEl ? "Λείπεις από τον Oli! 🌿" : "We miss you at Oli! 🌿",
    html: `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <tr><td style="text-align:center;padding-bottom:24px;">
      <span style="font-size:28px;font-weight:700;color:#194121;">🌱 Oli</span>
    </td></tr>
    <tr><td style="background:#fff;border-radius:16px;padding:32px;border:1px solid #e8e5dc;">
      <h1 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">
        ${isEl ? `${name}, πώς πάνε οι καλλιέργειες;` : `${name}, how are your crops doing?`}
      </h1>
      <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">
        ${isEl
          ? "Ο Oli είναι εδώ για να σε βοηθήσει με ό,τι χρειαστείς — από διάγνωση ασθενειών μέχρι πρόγραμμα ψεκασμών."
          : "Oli is here to help with anything you need — from disease diagnosis to spray schedules."
        }
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
        ${isEl
          ? "Στείλε μια φωτογραφία ή κάνε μια ερώτηση — είναι δωρεάν."
          : "Send a photo or ask a question — it's free."
        }
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr><td style="background:#194121;border-radius:12px;padding:14px 32px;">
          <a href="${APP_URL}/chat" style="color:#fff;text-decoration:none;font-weight:600;font-size:15px;">
            ${isEl ? "Επιστροφή στον Oli →" : "Back to Oli →"}
          </a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="text-align:center;padding-top:24px;">
      <p style="font-size:12px;color:#999;">
        <a href="${APP_URL}/profile" style="color:#999;">${isEl ? "Ρυθμίσεις ειδοποιήσεων" : "Notification settings"}</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

function upgradeInterestEmail(
  requester: { email: string; name: string; currentTier: string; requestedTier: string },
  lang: string,
): { subject: string; html: string } {
  const requestedTier = requester.requestedTier || "pro";
  const planLabel = requestedTier.charAt(0).toUpperCase() + requestedTier.slice(1);
  const subject = `Upgrade interest: ${planLabel}`;
  const isEl = lang === "el";

  return {
    subject,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f5f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e8e5dc;">
    <tr><td style="padding:28px 28px 8px;">
      <h1 style="margin:0;font-size:22px;color:#194121;">Oli upgrade request</h1>
    </td></tr>
    <tr><td style="padding:0 28px 28px;color:#485045;font-size:15px;line-height:1.6;">
      <p>${isEl
        ? "Ένας χρήστης ζήτησε αναβάθμιση από το paywall."
        : "A user requested an upgrade from the paywall."}</p>
      <p><strong>Name:</strong> ${requester.name || "Unknown"}</p>
      <p><strong>Email:</strong> ${requester.email}</p>
      <p><strong>Current tier:</strong> ${requester.currentTier || "free"}</p>
      <p><strong>Requested tier:</strong> ${planLabel}</p>
      <p><strong>Requested from:</strong> ${APP_URL}</p>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

function trialExpiryWarningEmail(
  name: string,
  tier: string,
  daysLeft: number,
  isFinal: boolean,
  lang: string,
): { subject: string; html: string } {
  const isEl = lang === "el";
  const tierLabel = tier === "master" ? "Master" : "Pro";
  const daysStr = daysLeft === 1
    ? (isEl ? "1 μέρα" : "1 day")
    : (isEl ? `${daysLeft} μέρες` : `${daysLeft} days`);

  const subject = isFinal
    ? (isEl ? `Oli: Η δοκιμή σου λήγει σε ${daysStr} ⏳` : `Oli: Your trial ends in ${daysStr} ⏳`)
    : (isEl ? `Oli: ${daysStr} ακόμα στο ${tierLabel}!` : `Oli: ${daysStr} left on ${tierLabel}!`);

  const heading = isFinal
    ? (isEl ? `${name}, σχεδόν τελείωσε!` : `${name}, almost there!`)
    : (isEl ? `${name}, η δοκιμή σου λήγει σύντομα` : `${name}, your trial is ending soon`);

  const body = isFinal
    ? (isEl
        ? `Η δωρεάν δοκιμή σου στο ${tierLabel} λήγει σε <strong>${daysStr}</strong>. Αναβάθμισε τώρα για να κρατήσεις τα χωράφια σου, το ιστορικό σου και τις απεριόριστες ερωτήσεις.`
        : `Your free ${tierLabel} trial ends in <strong>${daysStr}</strong>. Upgrade now to keep your fields, history, and unlimited questions.`)
    : (isEl
        ? `Απολαμβάνεις το ${tierLabel} δωρεάν! Η δοκιμή σου λήγει σε <strong>${daysStr}</strong>. Αναβάθμισε πριν λήξει για να συνεχίσεις χωρίς διακοπή.`
        : `You've been enjoying ${tierLabel} for free! Your trial ends in <strong>${daysStr}</strong>. Upgrade before it expires to continue without interruption.`);

  const cta = isEl ? `Αναβάθμιση σε ${tierLabel} →` : `Upgrade to ${tierLabel} →`;
  const footer = isEl ? "Αν δεν αναβαθμίσεις, ο λογαριασμός σου μεταβαίνει στο Δωρεάν πλάνο. Τα δεδομένα σου παραμένουν."
    : "If you don't upgrade, your account moves to the Free plan. Your data stays safe.";

  return {
    subject,
    html: `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <tr><td style="text-align:center;padding-bottom:24px;">
      <span style="font-size:28px;font-weight:700;color:#194121;">🌱 Oli</span>
    </td></tr>
    <tr><td style="background:#fff;border-radius:16px;padding:32px;border:1px solid #e8e5dc;">
      <div style="background:${isFinal ? '#fef3c7' : '#f0fdf4'};border:1px solid ${isFinal ? '#fde68a' : '#bbf7d0'};border-radius:10px;padding:10px 14px;margin-bottom:20px;font-size:13px;font-weight:600;color:${isFinal ? '#92400e' : '#166534'};">
        ${isFinal ? '⏳' : '🕐'} ${isEl ? `Η δοκιμή λήγει σε ${daysStr}` : `Trial ends in ${daysStr}`}
      </div>
      <h1 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">${heading}</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">${body}</p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
        <tr><td style="background:#194121;border-radius:12px;padding:14px 32px;">
          <a href="${APP_URL}/profile" style="color:#fff;text-decoration:none;font-weight:600;font-size:15px;">${cta}</a>
        </td></tr>
      </table>
      <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">${footer}</p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:24px;">
      <p style="font-size:12px;color:#999;">
        ${isEl ? "Αυτό το email στάλθηκε από το Oli" : "This email was sent by Oli"}
        · <a href="${APP_URL}/legal/privacy" style="color:#999;">Privacy</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

// ── Main handler ──
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

    // Cron modes + vio_reminder: accept service role key OR CRON_SECRET (set in edge function secrets)
    const serviceOnlyModes = ["vio_email_cron", "weekly_digest_cron", "onboarding_drip_cron", "reengagement_cron", "vio_reminder", "expiry_warning_cron"];
    if (serviceOnlyModes.includes(body.mode)) {
      const authHeader = req.headers.get("authorization") || "";
      const validSecret = SUPABASE_SERVICE_ROLE_KEY && authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
      const validCronKey = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
      if (!validSecret && !validCronKey) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
      }
    }

    // Helper: verify Bearer token and return the authenticated user
    const verifyBearerUser = async () => {
      const authHeader = req.headers.get("authorization") || "";
      if (!authHeader.startsWith("Bearer ")) return null;
      const token = authHeader.slice(7);
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: { user }, error } = await adminClient.auth.getUser(token);
      if (error || !user) return null;
      return user;
    };

    // Mode: welcome — requires authenticated user; email must match their auth record
    if (body.mode === "welcome") {
      const authedUser = await verifyBearerUser();
      if (!authedUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
      }
      const email = authedUser.email ?? "";
      if (!email || !isValidEmail(email)) {
        return new Response(JSON.stringify({ error: "no verified email on account" }), { status: 400, headers });
      }
      const { name, lang } = body;
      const tpl = welcomeEmail(name || "Farmer", lang || "en");
      const ok = await sendEmail(email, tpl.subject, tpl.html);
      return new Response(JSON.stringify({ sent: ok }), { headers });
    }

    if (body.mode === "upgrade_interest") {
      // Require auth: use the verified user's email to prevent support inbox spam
      const authedUser = await verifyBearerUser();
      if (!authedUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
      }
      const email = authedUser.email ?? "";
      if (!email || !isValidEmail(email)) {
        return new Response(JSON.stringify({ error: "no verified email on account" }), { status: 400, headers });
      }

      const tpl = upgradeInterestEmail(
        {
          email,
          name: typeof body.name === "string" ? body.name.trim() : "",
          currentTier: typeof body.currentTier === "string" ? body.currentTier : "free",
          requestedTier: typeof body.requestedTier === "string"
            ? body.requestedTier
            : typeof body.requestedPlan === "string"
              ? body.requestedPlan
              : "pro",
        },
        body.lang === "el" ? "el" : "en",
      );

      const ok = await sendEmail(SUPPORT_EMAIL, tpl.subject, tpl.html);
      return new Response(JSON.stringify({ sent: ok }), { headers });
    }

    // Mode: vio_reminder (single user)
    if (body.mode === "vio_reminder") {
      const { email, name, problem, step, lang } = body;
      if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers });
      if (!isValidEmail(email)) return new Response(JSON.stringify({ error: "invalid email format" }), { status: 400, headers });
      const tpl = vioReminderEmail(name || "Farmer", problem || "your crop", step ?? 1, lang || "en");
      const ok = await sendEmail(email, tpl.subject, tpl.html);
      return new Response(JSON.stringify({ sent: ok }), { headers });
    }

    // Mode: vio_email_cron — batch send VIO reminders via email
    if (body.mode === "vio_email_cron") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const now = new Date().toISOString();

      const { data: due } = await supabase
        .from("interventions")
        .select("id, user_id, crop_type, problem, vio_step")
        .lte("follow_up_at", now)
        .is("outcome", null)
        .lt("vio_step", 3);

      if (!due || due.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), { headers });
      }

      // Get user emails
      const userIds = [...new Set(due.map(d => d.user_id))];
      const { data: users } = await supabase
        .from("users")
        .select("id, name, auth_id")
        .in("id", userIds);

      // Get auth emails
      const authIds = (users || []).map(u => u.auth_id).filter(Boolean);
      const authUsers = await listAllAuthUsers(supabase);
      const emailMap: Record<string, { email: string; name: string }> = {};
      for (const u of (users || [])) {
        const authUser = authUsers.find((a) => a.id === u.auth_id);
        if (authUser?.email) {
          emailMap[u.id] = { email: authUser.email, name: u.name || "Farmer" };
        }
      }

      let sent = 0;
      for (const iv of due) {
        const user = emailMap[iv.user_id];
        if (!user) continue;

        // Check if user has push subscriptions — skip email if they do (push takes priority)
        const { count } = await supabase
          .from("push_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", iv.user_id);

        if ((count ?? 0) > 0) continue; // push will handle it

        const tpl = vioReminderEmail(user.name, iv.problem || iv.crop_type || "your crop", iv.vio_step ?? 1, "en");
        const ok = await sendEmail(user.email, tpl.subject, tpl.html);
        if (ok) sent++;

        // Always advance VIO step regardless of email delivery success.
        // This prevents the same intervention from being picked up on the next cron run
        // (every 6h), which would spam users. If delivery failed, the in-app VIO banner
        // shows the pending action when the user next opens the app.
        const nextStep = (iv.vio_step ?? 1) + 1;
        const nextFollowUpAt = nextStep < 3
          ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          : null;
        await supabase
          .from("interventions")
          .update(nextFollowUpAt
            ? { vio_step: nextStep, follow_up_at: nextFollowUpAt }
            : { vio_step: nextStep, follow_up_at: null }
          )
          .eq("id", iv.id);
      }

      return new Response(JSON.stringify({ sent, total: due.length }), { headers });
    }

    // Mode: weekly_digest_cron — batch send weekly digests
    if (body.mode === "weekly_digest_cron") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      // Get all active users
      const { data: users } = await supabase
        .from("users")
        .select("id, name, auth_id, notification_followup");

      if (!users || users.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), { headers });
      }

      // Get auth emails
      const authUsers = await listAllAuthUsers(supabase);

      let sent = 0;
      for (const u of users) {
        const authUser = authUsers.find((a) => a.id === u.auth_id);
        if (!authUser?.email) continue;

        // Count weekly stats
        const [msgRes, ivRes, outcomeRes, pendingRes] = await Promise.all([
          supabase.from("chat_messages").select("id", { count: "exact", head: true })
            .eq("user_id", u.id).gte("created_at", oneWeekAgo),
          supabase.from("interventions").select("id", { count: "exact", head: true })
            .eq("user_id", u.id).gte("created_at", oneWeekAgo),
          supabase.from("interventions").select("id", { count: "exact", head: true })
            .eq("user_id", u.id).not("outcome", "is", null).gte("updated_at", oneWeekAgo),
          supabase.from("interventions").select("id", { count: "exact", head: true })
            .eq("user_id", u.id).is("outcome", null).lt("vio_step", 3)
            .not("follow_up_at", "is", null),
        ]);

        const stats = {
          messages: msgRes.count ?? 0,
          interventions: ivRes.count ?? 0,
          outcomes: outcomeRes.count ?? 0,
          pendingVio: pendingRes.count ?? 0,
        };

        // Skip users with zero activity and no pending VIO
        if (stats.messages === 0 && stats.interventions === 0 && stats.pendingVio === 0) continue;

        const tpl = weeklyDigestEmail(u.name || "Farmer", stats, "en");
        const ok = await sendEmail(authUser.email, tpl.subject, tpl.html);
        if (ok) sent++;
      }

      return new Response(JSON.stringify({ sent }), { headers });
    }

    // Mode: onboarding_drip_cron — Day 3 & Day 7 emails for new users
    if (body.mode === "onboarding_drip_cron") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Day 3: users created 3 days ago (±12h window)
      const day3Start = new Date(Date.now() - 3.5 * 86400000).toISOString();
      const day3End = new Date(Date.now() - 2.5 * 86400000).toISOString();
      // Day 7: users created 7 days ago (±12h window)
      const day7Start = new Date(Date.now() - 7.5 * 86400000).toISOString();
      const day7End = new Date(Date.now() - 6.5 * 86400000).toISOString();

      const { data: day3Users } = await supabase
        .from("users")
        .select("id, name, auth_id, language")
        .gte("created_at", day3Start)
        .lte("created_at", day3End);

      const { data: day7Users } = await supabase
        .from("users")
        .select("id, name, auth_id, language")
        .gte("created_at", day7Start)
        .lte("created_at", day7End);

      const allUsers = [
        ...((day3Users || []).map(u => ({ ...u, day: 3 }))),
        ...((day7Users || []).map(u => ({ ...u, day: 7 }))),
      ];

      if (allUsers.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), { headers });
      }

      const authUsers = await listAllAuthUsers(supabase);

      let sent = 0;
      for (const u of allUsers) {
        const authUser = authUsers.find((a) => a.id === u.auth_id);
        if (!authUser?.email) continue;
        const tpl = onboardingDripEmail(u.name || "Farmer", u.day, u.language || "en");
        const ok = await sendEmail(authUser.email, tpl.subject, tpl.html);
        if (ok) sent++;
      }

      return new Response(JSON.stringify({ sent, total: allUsers.length }), { headers });
    }

    // Mode: reengagement_cron — email users inactive for 14+ days
    if (body.mode === "reengagement_cron") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
      const twentyOneDaysAgo = new Date(Date.now() - 21 * 86400000).toISOString();

      // Users whose last message is between 14-21 days ago (send once)
      const { data: users } = await supabase
        .from("users")
        .select("id, name, auth_id, language");

      if (!users || users.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), { headers });
      }

      const authUsers = await listAllAuthUsers(supabase);

      let sent = 0;
      for (const u of users) {
        const authUser = authUsers.find((a) => a.id === u.auth_id);
        if (!authUser?.email) continue;

        // Check last message date
        const { data: lastMsg } = await supabase
          .from("chat_messages")
          .select("created_at")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!lastMsg) continue;
        const lastActive = lastMsg.created_at;

        // Only send if last activity is 14-21 days ago
        if (lastActive > fourteenDaysAgo || lastActive < twentyOneDaysAgo) continue;

        const tpl = reEngagementEmail(u.name || "Farmer", u.language || "en");
        const ok = await sendEmail(authUser.email, tpl.subject, tpl.html);
        if (ok) sent++;
      }

      return new Response(JSON.stringify({ sent }), { headers });
    }

    // Mode: expiry_warning_cron — batch send trial/promo expiry warnings
    if (body.mode === "expiry_warning_cron") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const day = 86400000;
      const now = Date.now();

      // First warning window: tier expires 4–6 days from now, not yet warned
      const firstStart = new Date(now + 4 * day).toISOString();
      const firstEnd   = new Date(now + 6 * day).toISOString();
      // Final warning window: tier expires 1–3 days from now, not yet final-warned
      const finalStart = new Date(now + 1 * day).toISOString();
      const finalEnd   = new Date(now + 3 * day).toISOString();

      const [{ data: firstWarn }, { data: finalWarn }] = await Promise.all([
        supabase
          .from("users")
          .select("id, name, lang, auth_id, tier, tier_expires_at")
          .in("tier_source", ["promo", "trial"])
          .not("tier_expires_at", "is", null)
          .gte("tier_expires_at", firstStart)
          .lte("tier_expires_at", firstEnd)
          .is("expiry_warned_at", null),
        supabase
          .from("users")
          .select("id, name, lang, auth_id, tier, tier_expires_at")
          .in("tier_source", ["promo", "trial"])
          .not("tier_expires_at", "is", null)
          .gte("tier_expires_at", finalStart)
          .lte("tier_expires_at", finalEnd)
          .is("expiry_final_warned_at", null),
      ]);

      const allTargets = [
        ...((firstWarn || []).map(u => ({ ...u, isFinal: false }))),
        ...((finalWarn || []).map(u => ({ ...u, isFinal: true }))),
      ];

      if (allTargets.length === 0) {
        return new Response(JSON.stringify({ sent: 0, total: 0 }), { headers });
      }

      const authUsers = await listAllAuthUsers(supabase);
      let sent = 0;

      for (const u of allTargets) {
        const authUser = authUsers.find((a) => a.id === u.auth_id);
        if (!authUser?.email) continue;

        const expiresAt = new Date(u.tier_expires_at as string).getTime();
        const daysLeft = Math.max(1, Math.ceil((expiresAt - now) / day));
        const tpl = trialExpiryWarningEmail(
          u.name || "Farmer",
          u.tier || "pro",
          daysLeft,
          u.isFinal,
          u.lang || "en",
        );

        const ok = await sendEmail(authUser.email, tpl.subject, tpl.html);
        if (ok) {
          sent++;
          // Mark notification sent
          const updateCol = u.isFinal ? { expiry_final_warned_at: new Date().toISOString() }
                                      : { expiry_warned_at: new Date().toISOString() };
          await supabase.from("users").update(updateCol).eq("id", u.id);
        }
      }

      return new Response(JSON.stringify({ sent, total: allTargets.length }), { headers });
    }

    // Mode: weekly_plan_cron — Monday motivational plan for opted-in users
    if (body.mode === "weekly_plan_cron") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: users } = await supabase
        .from("users")
        .select("id, name, auth_id, lang, primary_crop, location")
        .eq("notification_weekly_plan", true);

      if (!users || users.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), { headers });
      }

      const authUsers = await listAllAuthUsers(supabase);
      let sent = 0;

      for (const u of users) {
        const authUser = authUsers.find((a) => a.id === u.auth_id);
        if (!authUser?.email) continue;

        const isEl = (u.lang ?? "en") === "el";
        const name = u.name || (isEl ? "Αγρότη" : "Farmer");
        const crop = u.primary_crop ?? "";
        const cropLine = crop ? (isEl ? ` για <b>${crop}</b>` : ` for <b>${crop}</b>`) : "";

        const subject = isEl
          ? `Oli: Καλή εβδομάδα, ${name}! Ξεκίνα τον εβδομαδιαίο σου πρόγραμμα`
          : `Oli: Good week, ${name}! Start your weekly agronomy plan`;

        const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
<svg width="22" height="22" viewBox="0 0 24 24" fill="#194121"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-13 6 0 0 .93-.98 2-2z"/></svg>
<span style="font-size:18px;font-weight:700;color:#194121">Oli</span>
</div>
<p style="font-size:15px;margin-bottom:12px">${isEl ? "Γεια σου" : "Hi"} <b>${name}</b>,</p>
<p style="font-size:14px;color:#333;line-height:1.6;margin-bottom:24px">
${isEl
  ? `Καλή εβδομάδα! Ρώτα τον Oli${cropLine} για το εβδομαδιαίο σου αγρονομικό πρόγραμμα — τι να ελέγξεις, τι να ψεκάσεις, τι να ετοιμάσεις.`
  : `Happy Monday! Ask Oli${cropLine} for your weekly agronomy plan — what to inspect, spray, or prepare this week.`}
</p>
<a href="https://ask-oli.com" style="display:inline-block;background:#194121;color:#fff;text-decoration:none;padding:12px 28px;border-radius:24px;font-size:14px;font-weight:600">${isEl ? "Άνοιξε το Oli →" : "Open Oli →"}</a>
<p style="margin-top:32px;font-size:11px;color:#999">${isEl ? "Για να σταματήσεις αυτά τα μηνύματα, άνοιξε Προφίλ → Ειδοποιήσεις." : "To stop these messages, open Profile → Notifications."}</p>
</div>`;

        const ok = await sendEmail(authUser.email, subject, html);
        if (ok) sent++;
      }

      return new Response(JSON.stringify({ sent, total: users.length }), { headers });
    }

    return new Response(
      JSON.stringify({ error: "Invalid mode. Use: welcome, vio_reminder, vio_email_cron, weekly_digest_cron, onboarding_drip_cron, reengagement_cron, expiry_warning_cron, weekly_plan_cron" }),
      { status: 400, headers }
    );
  } catch (e) {
    console.error("send-email error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
