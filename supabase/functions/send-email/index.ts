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
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://ask-oli.com";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const isAllowed =
    origin === ALLOWED_ORIGIN ||
    origin === "https://www.ask-oli.com" ||
    origin === "http://localhost:5173" ||
    origin === "http://localhost:3000" ||
    origin === "http://127.0.0.1:3000";
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-resource",
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

// ── Brand tokens ──
const TERRA = "#C4521A";
const GREEN = "#194121";
const CREAM_BG = "#F0EDE5";
const BORDER = "#DDD6CB";
const FOOTER_BG = "#EAE5DC";
const TEXT_BODY = "#3D3830";
const TEXT_MUTED = "#888077";
const HEADER_TEXT = "#F5EFE6";
const SAN = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const SER = `Georgia,'Times New Roman',serif`;

function base(lang: string, opts: {
  label?: string;
  headline: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  preheader?: string;
}): string {
  const { label, headline, body: bodyHtml, ctaText, ctaUrl, preheader } = opts;
  const isEl = lang === "el";
  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${CREAM_BG};-webkit-text-size-adjust:100%;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${CREAM_BG};">
  <tr><td style="padding:28px 16px 44px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;margin:0 auto;">
      <tr><td style="background:${TERRA};border-radius:16px 16px 0 0;padding:24px 32px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td><span style="font-size:15px;font-style:italic;font-family:${SER};color:${HEADER_TEXT};letter-spacing:0.01em;">· Oli</span></td>
            ${label ? `<td style="text-align:right;"><span style="font-size:10px;font-family:${SAN};color:${HEADER_TEXT};letter-spacing:0.12em;text-transform:uppercase;opacity:0.7;">${label}</span></td>` : ""}
          </tr>
        </table>
        <h1 style="margin:18px 0 0;font-size:26px;line-height:1.28;letter-spacing:-0.02em;font-style:italic;font-family:${SER};color:${HEADER_TEXT};">${headline}</h1>
      </td></tr>
      <tr><td style="background:#ffffff;padding:32px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};">
        ${bodyHtml}
        ${ctaText && ctaUrl ? `
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 4px;">
          <tr><td style="background:${GREEN};border-radius:10px;">
            <a href="${ctaUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-family:${SAN};font-size:15px;font-weight:600;">${ctaText}</a>
          </td></tr>
        </table>` : ""}
      </td></tr>
      <tr><td style="background:${FOOTER_BG};border-radius:0 0 16px 16px;border:1px solid ${BORDER};border-top:none;padding:16px 32px;">
        <p style="margin:0;font-size:11.5px;font-family:${SAN};color:${TEXT_MUTED};line-height:1.5;">
          ${isEl ? "Αυτό το email στάλθηκε από το Oli" : "This email was sent by Oli"}&nbsp;·&nbsp;<a href="${APP_URL}/legal/privacy" style="color:${TEXT_MUTED};text-decoration:none;">${isEl ? "Απόρρητο" : "Privacy"}</a>&nbsp;·&nbsp;<a href="${APP_URL}/profile" style="color:${TEXT_MUTED};text-decoration:none;">${isEl ? "Ρυθμίσεις" : "Notifications"}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function ep(text: string, extra = ""): string {
  return `<p style="margin:0 0 16px;font-size:15px;font-family:${SAN};color:${TEXT_BODY};line-height:1.65;${extra}">${text}</p>`;
}
function esmall(text: string): string {
  return `<p style="margin:12px 0 0;font-size:12.5px;font-family:${SAN};color:${TEXT_MUTED};line-height:1.5;">${text}</p>`;
}
function ehr(): string {
  return `<hr style="margin:20px 0;border:none;border-top:1px solid #E5E0D6;">`;
}

// ── Email templates ──

function welcomeEmail(name: string, lang: string): { subject: string; html: string } {
  const isEl = lang === "el";
  return {
    subject: isEl ? "Καλώς ήρθες στο Oli! 🌱" : "Welcome to Oli. 🌱",
    html: base(lang, {
      label: isEl ? "ΚΑΛΩΣ ΗΡΘΕΣ" : "WELCOME",
      headline: isEl ? "Ο γεωπόνος σου είναι έτοιμος." : "Your agronomist is ready.",
      preheader: isEl ? "Στείλε μια φωτογραφία και πάρε άμεση διάγνωση." : "Send a photo and get instant crop diagnosis.",
      body: [
        ep(isEl ? `Γεια σου <b>${name}</b>,` : `Hi <b>${name}</b>,`),
        ep(isEl
          ? "Ο Oli είναι ο AI γεωπόνος σου — 24/7 διαθέσιμος για διαγνώσεις καλλιεργειών, συμβουλές ψεκασμού και παρακολούθηση παρεμβάσεων. Δωρεάν για τις πρώτες 20 ερωτήσεις κάθε μήνα."
          : "Oli is your AI agronomist — available 24/7 for crop diagnosis, spray advice, and intervention tracking. Free for your first 20 questions each month."),
        ep(isEl
          ? "Ξεκίνα στέλνοντας μια φωτογραφία ή ρωτώντας οτιδήποτε για τις καλλιέργειές σου."
          : "Get started by sending a photo or asking anything about your crops."),
        ehr(),
        esmall(isEl
          ? "Μπορείς επίσης να εγκαταστήσεις τον Oli ως εφαρμογή από το browser του κινητού σου."
          : "You can also install Oli as an app from your phone's browser."),
      ].join(""),
      ctaText: isEl ? "Ξεκίνα εδώ →" : "Start here →",
      ctaUrl: `${APP_URL}/chat`,
    }),
  };
}

function vioReminderEmail(
  name: string,
  problem: string,
  step: number,
  lang: string,
): { subject: string; html: string } {
  const isEl = lang === "el";
  const isApply = step <= 1;
  const subject = isApply
    ? (isEl ? `Oli: Εφάρμοσες τη θεραπεία για "${problem}";` : `Oli: Did you apply the treatment for "${problem}"?`)
    : (isEl ? `Oli: Βλέπεις βελτίωση στο "${problem}";` : `Oli: Any improvement with "${problem}"?`);
  return {
    subject,
    html: base(lang, {
      label: isApply ? (isEl ? "ΠΑΡΑΚΟΛΟΥΘΗΣΗ" : "FOLLOW-UP") : (isEl ? "ΑΠΟΤΕΛΕΣΜΑ" : "OUTCOME"),
      headline: isApply
        ? (isEl ? "Εφάρμοσες τη θεραπεία;" : "Did you apply the treatment?")
        : (isEl ? "Βλέπεις βελτίωση;" : "Any improvement?"),
      preheader: subject,
      body: [
        ep(isApply
          ? (isEl ? `Πριν από 3 μέρες κατέγραψες παρέμβαση για <b>${problem}</b>. Εφάρμοσες τη συνιστώμενη θεραπεία;` : `3 days ago you logged an intervention for <b>${problem}</b>. Did you apply the recommended treatment?`)
          : (isEl ? `Πριν από περίπου μια εβδομάδα εφάρμοσες θεραπεία για <b>${problem}</b>. Βλέπεις βελτίωση;` : `About a week ago you applied treatment for <b>${problem}</b>. Are you seeing any improvement?`)),
        ep(isEl ? "Ανοίξε τον Oli για να καταγράψεις το αποτέλεσμα." : "Open Oli to record the outcome."),
      ].join(""),
      ctaText: isEl ? "Καταγραφή αποτελέσματος →" : "Log your result →",
      ctaUrl: `${APP_URL}/chat`,
    }),
  };
}

function weeklyDigestEmail(
  name: string,
  stats: { messages: number; interventions: number; outcomes: number; pendingVio: number },
  lang: string,
): { subject: string; html: string } {
  const isEl = lang === "el";
  const week = new Date().toLocaleDateString(isEl ? "el-GR" : "en-GB", { month: "short", day: "numeric" });

  const statCell = (value: number, label: string, warn = false): string =>
    `<td style="width:50%;padding:14px;text-align:center;background:#F7F5F0;border-radius:8px;">
      <div style="font-size:30px;font-weight:700;font-family:${SER};font-style:italic;color:${warn && value > 0 ? TERRA : GREEN};">${value}</div>
      <div style="font-size:11px;font-family:${SAN};color:${TEXT_MUTED};margin-top:4px;letter-spacing:0.06em;text-transform:uppercase;">${label}</div>
    </td>`;

  const pendingNote = stats.pendingVio > 0
    ? `<p style="margin:0 0 16px;padding:12px 16px;background:#FEF5EE;border-left:3px solid ${TERRA};border-radius:0 8px 8px 0;font-size:14px;font-family:${SAN};color:#7A3010;line-height:1.5;">${isEl ? `${stats.pendingVio} παρεμβάσεις περιμένουν αποτέλεσμα.` : `${stats.pendingVio} intervention${stats.pendingVio > 1 ? "s" : ""} awaiting outcome.`}</p>`
    : "";

  return {
    subject: isEl ? `Oli: Η εβδομάδα σου (${week})` : `Oli: Your week (${week})`,
    html: base(lang, {
      label: isEl ? `ΕΒΔΟΜΑΔΑ ${week.toUpperCase()}` : `WEEK OF ${week.toUpperCase()}`,
      headline: isEl
        ? `${stats.messages} μηνύματα. ${stats.interventions} παρεμβάσεις.`
        : `${stats.messages} messages. ${stats.interventions} interventions.`,
      preheader: isEl ? "Δες τι έγινε στις καλλιέργειές σου αυτή την εβδομάδα." : "See what happened on your farm this week.",
      body: [
        ep(isEl ? `Γεια σου <b>${name}</b>, ιδού η εβδομάδα σου:` : `Hi <b>${name}</b>, here's your week:`),
        `<table width="100%" cellpadding="4" cellspacing="0" role="presentation" style="margin:0 0 20px;">
          <tr>${statCell(stats.messages, isEl ? "Μηνύματα" : "Messages")}<td style="width:8px;"></td>${statCell(stats.interventions, isEl ? "Παρεμβάσεις" : "Interventions")}</tr>
          <tr><td colspan="3" style="height:8px;"></td></tr>
          <tr>${statCell(stats.outcomes, isEl ? "Αποτελέσματα" : "Outcomes")}<td style="width:8px;"></td>${statCell(stats.pendingVio, isEl ? "Εκκρεμή VIO" : "Pending VIO", true)}</tr>
        </table>`,
        pendingNote,
      ].join(""),
      ctaText: isEl ? "Δες το ιστορικό →" : "View history →",
      ctaUrl: `${APP_URL}/history`,
    }),
  };
}

function onboardingDripEmail(name: string, day: number, lang: string): { subject: string; html: string } {
  const isEl = lang === "el";
  const isDay3 = day <= 3;
  return {
    subject: isDay3
      ? (isEl ? "Ήξερες ότι ο Oli αναγνωρίζει 200+ ασθένειες;" : "Did you know Oli detects 200+ diseases?")
      : (isEl ? "Ο Oli σε περιμένει — δωρεάν ακόμα!" : "Oli is waiting — still free!"),
    html: base(lang, {
      label: isDay3 ? (isEl ? "ΜΕΡΑ 3" : "DAY 3") : (isEl ? "ΑΚΟΜΑ ΔΩΡΕΑΝ" : "STILL FREE"),
      headline: isDay3
        ? (isEl ? "200+ ασθένειες αναγνωρίζονται." : "200+ diseases detected.")
        : (isEl ? "20 δωρεάν ερωτήσεις το μήνα." : "20 free questions a month."),
      body: ep(isDay3
        ? (isEl
            ? `<b>${name}</b>, στείλε μια φωτογραφία της καλλιέργειάς σου και πάρε άμεση διάγνωση με σύσταση θεραπείας. Ο Oli αναγνωρίζει πάνω από 200 ασθένειες και παράσιτα.`
            : `<b>${name}</b>, send a photo of your crop and get instant diagnosis with treatment advice. Oli detects over 200 diseases and pests.`)
        : (isEl
            ? `<b>${name}</b>, έχεις 20 δωρεάν ερωτήσεις κάθε μήνα. Ρώτα τον Oli για ψεκασμούς, λίπανση ή ό,τι αφορά τις καλλιέργειές σου.`
            : `<b>${name}</b>, you have 20 free questions every month. Ask Oli about spraying, fertilization, or anything about your crops.`)),
      ctaText: isDay3 ? (isEl ? "Στείλε φωτογραφία →" : "Send a photo →") : (isEl ? "Ρώτα τον Oli →" : "Ask Oli →"),
      ctaUrl: `${APP_URL}/chat`,
    }),
  };
}

function reEngagementEmail(name: string, lang: string): { subject: string; html: string } {
  const isEl = lang === "el";
  return {
    subject: isEl ? "Οι καλλιέργειες δεν περιμένουν. 🌿" : "Your crops don't wait. 🌿",
    html: base(lang, {
      label: isEl ? "ΣΚΕΦΤΟΜΑΣΤΕ ΓΙΑ ΣΑΣ" : "WE'VE BEEN THINKING",
      headline: isEl ? "Οι καλλιέργειες δεν περιμένουν." : "Your crops don't wait.",
      preheader: isEl ? "Ο Oli είναι εδώ — δωρεάν." : "Oli is here — free.",
      body: [
        ep(isEl ? `<b>${name}</b>,` : `<b>${name}</b>,`),
        ep(isEl
          ? "Ο Oli είναι εδώ για ό,τι χρειαστείς — από διάγνωση ασθενειών μέχρι πρόγραμμα ψεκασμών. Δωρεάν."
          : "Oli is here for whatever you need — from disease diagnosis to spray schedules. Free."),
      ].join(""),
      ctaText: isEl ? "Επιστροφή στον Oli →" : "Back to Oli →",
      ctaUrl: `${APP_URL}/chat`,
    }),
  };
}

function upgradeInterestEmail(
  requester: { email: string; name: string; currentTier: string; requestedTier: string },
  _lang: string,
): { subject: string; html: string } {
  const planLabel = (requester.requestedTier || "pro").charAt(0).toUpperCase() + (requester.requestedTier || "pro").slice(1);
  return {
    subject: `Upgrade interest: ${planLabel} — ${requester.name || requester.email}`,
    html: base("en", {
      label: "UPGRADE REQUEST",
      headline: `${requester.name || "A user"} wants ${planLabel}.`,
      body: [
        `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #E5E0D6;font-size:14px;font-family:${SAN};color:${TEXT_MUTED};">Name</td><td style="padding:8px 0;border-bottom:1px solid #E5E0D6;font-size:14px;font-family:${SAN};color:${TEXT_BODY};font-weight:600;">${requester.name || "—"}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #E5E0D6;font-size:14px;font-family:${SAN};color:${TEXT_MUTED};">Email</td><td style="padding:8px 0;border-bottom:1px solid #E5E0D6;font-size:14px;font-family:${SAN};color:${TEXT_BODY};font-weight:600;">${requester.email}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #E5E0D6;font-size:14px;font-family:${SAN};color:${TEXT_MUTED};">Current tier</td><td style="padding:8px 0;border-bottom:1px solid #E5E0D6;font-size:14px;font-family:${SAN};color:${TEXT_BODY};">${requester.currentTier || "free"}</td></tr>
          <tr><td style="padding:8px 0;font-size:14px;font-family:${SAN};color:${TEXT_MUTED};">Requested</td><td style="padding:8px 0;font-size:14px;font-family:${SAN};color:${TERRA};font-weight:700;">${planLabel}</td></tr>
        </table>`,
        ep(`Reach out at <a href="mailto:${requester.email}" style="color:${TERRA};">${requester.email}</a> to process the upgrade.`),
      ].join(""),
    }),
  };
}

function trialExpiryWarningEmail(
  name: string,
  tier: string,
  daysLeft: number,
  isToday: boolean,
  lang: string,
): { subject: string; html: string } {
  const isEl = lang === "el";
  const tierLabel = tier === "master" ? "Master" : "Pro";
  const daysStr = daysLeft <= 1
    ? (isEl ? "1 μέρα" : "1 day")
    : (isEl ? `${daysLeft} μέρες` : `${daysLeft} days`);
  const todayLabel = isEl ? "ΣΗΜΕΡΑ ΛΗΓΕΙ" : "EXPIRES TODAY";
  return {
    subject: isToday
      ? (isEl ? `Oli: Η δοκιμή σου λήγει σήμερα ⏳` : `Oli: Your trial expires today ⏳`)
      : (isEl ? `Oli: ${daysStr} ακόμα στο ${tierLabel}` : `Oli: ${daysStr} left on ${tierLabel}`),
    html: base(lang, {
      label: isToday ? todayLabel : (isEl ? `${daysStr.toUpperCase()} ΑΠΟΜΕΝΟΥΝ` : `${daysStr.toUpperCase()} LEFT`),
      headline: isToday
        ? (isEl ? "Σήμερα λήγει η δοκιμή σου." : "Your trial ends today.")
        : (isEl ? `Η δοκιμή ${tierLabel} τελειώνει σε ${daysStr}.` : `Your ${tierLabel} trial ends in ${daysStr}.`),
      preheader: isEl ? "Αναβάθμισε πριν λήξει η δοκιμή σου." : "Upgrade before your trial expires.",
      body: [
        ep(isEl ? `<b>${name}</b>,` : `<b>${name}</b>,`),
        ep(isToday
          ? (isEl
              ? `Η δωρεάν δοκιμή σου στο <b>${tierLabel}</b> λήγει <b>σήμερα</b>. Αναβάθμισε τώρα για να κρατήσεις τα χωράφια σου, το ιστορικό σου και τις απεριόριστες ερωτήσεις.`
              : `Your free <b>${tierLabel}</b> trial ends <b>today</b>. Upgrade now to keep your fields, history, and unlimited questions.`)
          : (isEl
              ? `Απολαμβάνεις το <b>${tierLabel}</b> δωρεάν! Η δοκιμή σου λήγει σε <b>${daysStr}</b>. Αναβάθμισε πριν λήξει.`
              : `You've been enjoying <b>${tierLabel}</b> for free! Your trial ends in <b>${daysStr}</b>. Upgrade before it expires.`)),
        esmall(isEl
          ? "Αν δεν αναβαθμίσεις, ο λογαριασμός σου μεταβαίνει στο Free πλάνο. Τα δεδομένα σου παραμένουν."
          : "If you don't upgrade, your account moves to the Free plan. Your data stays safe."),
      ].join(""),
      ctaText: isEl ? `Αναβάθμιση σε ${tierLabel} →` : `Upgrade to ${tierLabel} →`,
      ctaUrl: `${APP_URL}/profile`,
    }),
  };
}

function subscriptionExpiredEmail(name: string, tier: string, lang: string): { subject: string; html: string } {
  const isEl = lang === "el";
  const tierLabel = tier === "master" ? "Master" : "Pro";
  return {
    subject: isEl ? `Oli: Η δοκιμή ${tierLabel} έληξε` : `Oli: Your ${tierLabel} trial has ended`,
    html: base(lang, {
      label: isEl ? "ΕΛΗΞΕ Η ΔΟΚΙΜΗ" : "TRIAL ENDED",
      headline: isEl ? "Είσαι πίσω στο Free." : "You're back on Free.",
      preheader: isEl ? "Τα δεδομένα σου είναι ασφαλή." : "Your data is safe.",
      body: [
        ep(isEl ? `<b>${name}</b>,` : `<b>${name}</b>,`),
        ep(isEl
          ? `Η δωρεάν δοκιμή σου στο <b>${tierLabel}</b> έληξε και ο λογαριασμός σου επέστρεψε στο Free πλάνο. Τα χωράφια σου, οι διαγνώσεις σου και το ιστορικό παρεμβάσεών σου παραμένουν ασφαλή.`
          : `Your free <b>${tierLabel}</b> trial has ended and your account is back on the Free plan. Your fields, diagnoses, and intervention history are all safe.`),
        ep(isEl
          ? "Αν θέλεις να συνεχίσεις με απεριόριστες ερωτήσεις και πλήρη πρόσβαση, αναβάθμισε οποιαδήποτε στιγμή."
          : "If you'd like to continue with unlimited questions and full access, you can upgrade anytime."),
        esmall(isEl
          ? "Στο Free πλάνο έχεις 20 δωρεάν ερωτήσεις κάθε μήνα."
          : "On the Free plan you have 20 free questions every month."),
      ].join(""),
      ctaText: isEl ? "Αναβάθμιση →" : "Upgrade →",
      ctaUrl: `${APP_URL}/profile`,
    }),
  };
}

function subscriptionConfirmationEmail(name: string, tier: string, lang: string): { subject: string; html: string } {
  const isEl = lang === "el";
  const tierLabel = tier === "master" ? "Master" : "Pro";
  const features = tier === "master"
    ? (isEl
        ? ["Απεριόριστες ερωτήσεις & διαγνώσεις", "Απεριόριστα χωράφια", "Διαχείριση πελατών (agronomist mode)", "Πρόσβαση συνεταιρισμού"]
        : ["Unlimited questions & diagnoses", "Unlimited fields", "Client management (agronomist mode)", "Cooperative access"])
    : (isEl
        ? ["Απεριόριστες ερωτήσεις & διαγνώσεις", "Απεριόριστα χωράφια", "Πλήρες ιστορικό παρεμβάσεων"]
        : ["Unlimited questions & diagnoses", "Unlimited fields", "Full intervention history"]);

  const featureRows = features.map(f =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #EDE8DF;font-size:14px;font-family:${SAN};color:${TEXT_BODY};line-height:1.5;"><span style="color:${TERRA};font-weight:700;margin-right:10px;">✓</span>${f}</td></tr>`
  ).join("");

  return {
    subject: isEl ? `Είσαι πλέον στο Oli ${tierLabel}! 🌿` : `You're on Oli ${tierLabel}. 🌿`,
    html: base(lang, {
      label: isEl ? "ΕΠΙΒΕΒΑΙΩΣΗ" : "CONFIRMED",
      headline: isEl ? `Είσαι στο Oli ${tierLabel}.` : `You're on Oli ${tierLabel}.`,
      preheader: isEl ? `Η συνδρομή σου ενεργοποιήθηκε.` : `Your ${tierLabel} subscription is now active.`,
      body: [
        ep(isEl ? `<b>${name}</b>, ευχαριστούμε!` : `<b>${name}</b>, thank you!`),
        ep(isEl
          ? `Η συνδρομή σου στο <b>Oli ${tierLabel}</b> ενεργοποιήθηκε. Ιδού τι έχεις τώρα στη διάθεσή σου:`
          : `Your <b>Oli ${tierLabel}</b> subscription is active. Here's what you now have:`),
        `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;background:#F7F5F0;border-radius:10px;padding:4px 16px;">${featureRows}</table>`,
        ep(isEl
          ? `Για οποιαδήποτε ερώτηση, επικοινώνησε μαζί μας στο <a href="mailto:hello@ask-oli.com" style="color:${TERRA};text-decoration:none;">hello@ask-oli.com</a>.`
          : `For any questions, reach us at <a href="mailto:hello@ask-oli.com" style="color:${TERRA};text-decoration:none;">hello@ask-oli.com</a>.`),
      ].join(""),
      ctaText: isEl ? "Ξεκίνα τον Oli →" : "Start using Oli →",
      ctaUrl: `${APP_URL}/chat`,
    }),
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
    const serviceOnlyModes = ["vio_email_cron", "weekly_digest_cron", "reengagement_cron", "vio_reminder", "expiry_warning_cron"];
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
        // Step 1→2 gap is 7 days (results check at ~day 10 from intervention log).
        const nextStep = (iv.vio_step ?? 1) + 1;
        const nextFollowUpAt = nextStep < 3
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
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

    // Mode: reengagement_cron — email users inactive 30–37 days
    // Window starts at 30d so it never overlaps with weekly engagement (active last 30d).
    if (body.mode === "reengagement_cron") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const thirtyDaysAgo  = new Date(Date.now() - 30 * 86400000).toISOString();
      const thirtySevenDaysAgo = new Date(Date.now() - 37 * 86400000).toISOString();

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

        const { data: lastMsg } = await supabase
          .from("chat_messages")
          .select("created_at")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!lastMsg) continue;
        const lastActive = lastMsg.created_at;

        // Only send if last activity is 30–37 days ago
        if (lastActive > thirtyDaysAgo || lastActive < thirtySevenDaysAgo) continue;

        const tpl = reEngagementEmail(u.name || "Farmer", u.language || "en");
        const ok = await sendEmail(authUser.email, tpl.subject, tpl.html);
        if (ok) sent++;
      }

      return new Response(JSON.stringify({ sent }), { headers });
    }

    // Mode: expiry_warning_cron — 3-touch expiry sequence
    // Touch 1: 3 days before (expiry_warned_at)
    // Touch 2: same day morning (expiry_final_warned_at)
    // Touch 3: 2 days after — "you're off, renew?" (expiry_post_warned_at, set by new column)
    if (body.mode === "expiry_warning_cron") {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const day = 86400000;
      const now = Date.now();
      const halfDay = day / 2;

      // Touch 1: expires 2.5–3.5 days from now, not yet warned
      const t1Start = new Date(now + 2.5 * day).toISOString();
      const t1End   = new Date(now + 3.5 * day).toISOString();
      // Touch 2: expires within ±12h of now (same day), not yet day-warned
      const t2Start = new Date(now - halfDay).toISOString();
      const t2End   = new Date(now + halfDay).toISOString();
      // Touch 3: expired 1.5–2.5 days ago, not yet post-warned
      const t3Start = new Date(now - 2.5 * day).toISOString();
      const t3End   = new Date(now - 1.5 * day).toISOString();

      const [{ data: t1Users }, { data: t2Users }, { data: t3Users }] = await Promise.all([
        supabase
          .from("users")
          .select("id, name, language, auth_id, tier, tier_expires_at")
          .in("tier_source", ["promo", "trial"])
          .not("tier_expires_at", "is", null)
          .gte("tier_expires_at", t1Start)
          .lte("tier_expires_at", t1End)
          .is("expiry_warned_at", null),
        supabase
          .from("users")
          .select("id, name, language, auth_id, tier, tier_expires_at")
          .in("tier_source", ["promo", "trial"])
          .not("tier_expires_at", "is", null)
          .gte("tier_expires_at", t2Start)
          .lte("tier_expires_at", t2End)
          .is("expiry_final_warned_at", null),
        supabase
          .from("users")
          .select("id, name, language, auth_id, tier, tier_expired_at")
          .not("tier_expired_at", "is", null)
          .gte("tier_expired_at", t3Start)
          .lte("tier_expired_at", t3End)
          .is("expiry_post_warned_at", null),
      ]);

      const authUsers = await listAllAuthUsers(supabase);
      let sent = 0;
      let total = 0;

      // Touch 1 — 3 days before
      for (const u of (t1Users || [])) {
        total++;
        const authUser = authUsers.find((a) => a.id === u.auth_id);
        if (!authUser?.email) continue;
        const expiresAt = new Date(u.tier_expires_at as string).getTime();
        const daysLeft = Math.max(2, Math.round((expiresAt - now) / day));
        const tpl = trialExpiryWarningEmail(u.name || "Farmer", u.tier || "pro", daysLeft, false, u.language || "en");
        const ok = await sendEmail(authUser.email, tpl.subject, tpl.html);
        if (ok) {
          sent++;
          await supabase.from("users").update({ expiry_warned_at: new Date().toISOString() }).eq("id", u.id);
        }
      }

      // Touch 2 — same day morning
      for (const u of (t2Users || [])) {
        total++;
        const authUser = authUsers.find((a) => a.id === u.auth_id);
        if (!authUser?.email) continue;
        const tpl = trialExpiryWarningEmail(u.name || "Farmer", u.tier || "pro", 0, true, u.language || "en");
        const ok = await sendEmail(authUser.email, tpl.subject, tpl.html);
        if (ok) {
          sent++;
          await supabase.from("users").update({ expiry_final_warned_at: new Date().toISOString() }).eq("id", u.id);
        }
      }

      // Touch 3 — 2 days after (you're back on free, renew?)
      for (const u of (t3Users || [])) {
        total++;
        const authUser = authUsers.find((a) => a.id === u.auth_id);
        if (!authUser?.email) continue;
        const tpl = subscriptionExpiredEmail(u.name || "Farmer", u.tier || "pro", u.language || "en");
        const ok = await sendEmail(authUser.email, tpl.subject, tpl.html);
        if (ok) {
          sent++;
          await supabase.from("users").update({ expiry_post_warned_at: new Date().toISOString() }).eq("id", u.id);
        }
      }

      return new Response(JSON.stringify({ sent, total }), { headers });
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
          ? `Oli: Καλή εβδομάδα, ${name}! Ξεκίνα το εβδομαδιαίο σου πρόγραμμα`
          : `Oli: Good week, ${name}! Start your weekly agronomy plan`;

        const html = base(u.lang ?? "en", {
          label: isEl ? "ΕΒΔΟΜΑΔΙΑΙΟ ΠΡΟΓΡΑΜΜΑ" : "WEEKLY PLAN",
          headline: isEl ? "Τι σε περιμένει αυτή την εβδομάδα;" : "What's ahead this week?",
          preheader: isEl
            ? "Ρώτα τον Oli για το εβδομαδιαίο σου αγρονομικό πρόγραμμα."
            : "Ask Oli for your weekly agronomy plan.",
          body: [
            ep(isEl ? `Γεια σου <b>${name}</b>,` : `Hi <b>${name}</b>,`),
            ep(isEl
              ? `Καλή εβδομάδα! Ρώτα τον Oli${cropLine} για το εβδομαδιαίο σου αγρονομικό πρόγραμμα — τι να ελέγξεις, τι να ψεκάσεις, τι να ετοιμάσεις.`
              : `Happy Monday! Ask Oli${cropLine} for your weekly agronomy plan — what to inspect, spray, or prepare this week.`),
            esmall(isEl
              ? "Για να σταματήσεις αυτά τα μηνύματα, άνοιξε Προφίλ → Ειδοποιήσεις."
              : "To stop these messages, open Profile → Notifications."),
          ].join(""),
          ctaText: isEl ? "Άνοιξε τον Oli →" : "Open Oli →",
          ctaUrl: `${APP_URL}/chat`,
        });

        const ok = await sendEmail(authUser.email, subject, html);
        if (ok) sent++;
      }

      return new Response(JSON.stringify({ sent, total: users.length }), { headers });
    }

    // Mode: subscription_confirmation — send on successful Stripe subscription
    if (body.mode === "subscription_confirmation") {
      const authedUser = await verifyBearerUser();
      if (!authedUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
      }
      const email = authedUser.email ?? "";
      if (!email || !isValidEmail(email)) {
        return new Response(JSON.stringify({ error: "no verified email on account" }), { status: 400, headers });
      }
      const { name, tier, lang } = body;
      const tpl = subscriptionConfirmationEmail(name || "Farmer", tier || "pro", lang || "en");
      const ok = await sendEmail(email, tpl.subject, tpl.html);
      return new Response(JSON.stringify({ sent: ok }), { headers });
    }

    return new Response(
      JSON.stringify({ error: "Invalid mode. Use: welcome, vio_reminder, vio_email_cron, weekly_digest_cron, reengagement_cron, expiry_warning_cron, weekly_plan_cron, subscription_confirmation, upgrade_interest" }),
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
