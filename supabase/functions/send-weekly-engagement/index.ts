// Oli Weekly Engagement Edge Function
// Sends crop-specific prompt deep-links to active users every Monday.
// Active = at least one chat message in the last 30 days.
// Channel priority: push notification first (silent VAPID), email fallback (Resend).
// Deep-link format: https://ask-oli.com/chat?prompt=<encoded>
// Called by pg_cron every Monday at 09:00 UTC with { "mode": "engagement_cron" }.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Oli <noreply@ask-oli.com>";
const APP_URL = Deno.env.get("APP_URL") || "https://ask-oli.com";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@ask-oli.com";

// ── VAPID helpers (copied from send-push) ──

function decodeBase64url(s: string): Uint8Array {
  const padding = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function buildPkcs8(rawPrivKey: Uint8Array, rawPubKey: Uint8Array): ArrayBuffer {
  const prefix = new Uint8Array([
    0x30, 0x81, 0x87,
    0x02, 0x01, 0x00,
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0x04, 0x6d,
    0x30, 0x6b,
    0x02, 0x01, 0x01,
    0x04, 0x20,
  ]);
  const midfix = new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00]);
  const result = new Uint8Array(prefix.length + 32 + midfix.length + 65);
  result.set(prefix);
  result.set(rawPrivKey.slice(0, 32), prefix.length);
  result.set(midfix, prefix.length + 32);
  result.set(rawPubKey.slice(0, 65), prefix.length + 32 + midfix.length);
  return result.buffer;
}

async function generateVapidJWT(audience: string): Promise<string> {
  const enc = new TextEncoder();
  const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: expiry, sub: VAPID_SUBJECT };

  const privKeyBytes = decodeBase64url(VAPID_PRIVATE_KEY);
  const pubKeyBytes = decodeBase64url(VAPID_PUBLIC_KEY);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    buildPkcs8(privKeyBytes, pubKeyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const sigInput = enc.encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, sigInput);
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

// Silent VAPID push — reliable across all push services; SW shows notification with default text.
async function sendSilentPush(endpoint: string): Promise<boolean> {
  try {
    const audience = new URL(endpoint).origin;
    const jwt = await generateVapidJWT(audience);
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        TTL: "86400",
        Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      },
    });
    if (resp.status === 410 || resp.status === 404) return false; // expired subscription
    return resp.ok;
  } catch {
    return false;
  }
}

// ── Email helpers ──

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Brand tokens (mirrors send-email) ──
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

function ep(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;font-family:${SAN};color:${TEXT_BODY};line-height:1.65;">${text}</p>`;
}

function engagementEmail(opts: {
  name: string;
  lang: string;
  prompt: string;
  deepLink: string;
}): { subject: string; html: string } {
  const { name, lang, prompt, deepLink } = opts;
  const isEl = lang === "el";
  const subject = isEl
    ? `Oli: Τι κάνουν οι καλλιέργειές σου αυτή την εβδομάδα;`
    : `Oli: How are your crops this week?`;

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${CREAM_BG};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;">${isEl ? "Ο Oli έχει μια ερώτηση για σένα" : "Oli has a question for you"}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${CREAM_BG};">
  <tr><td style="padding:28px 16px 44px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;margin:0 auto;">
      <tr><td style="background:${TERRA};border-radius:16px 16px 0 0;padding:24px 32px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td><span style="font-size:15px;font-style:italic;font-family:${SER};color:${HEADER_TEXT};letter-spacing:0.01em;">· Oli</span></td>
            <td style="text-align:right;"><span style="font-size:10px;font-family:${SAN};color:${HEADER_TEXT};letter-spacing:0.12em;text-transform:uppercase;opacity:0.7;">${isEl ? "ΕΒΔΟΜΑΔΙΑΙΑ ΕΝΗΜΕΡΩΣΗ" : "WEEKLY CHECK-IN"}</span></td>
          </tr>
        </table>
        <h1 style="margin:18px 0 0;font-size:26px;line-height:1.28;letter-spacing:-0.02em;font-style:italic;font-family:${SER};color:${HEADER_TEXT};">${isEl ? "Τι κάνουν οι καλλιέργειές σου;" : "How are your crops this week?"}</h1>
      </td></tr>
      <tr><td style="background:#ffffff;padding:32px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};">
        ${ep(isEl ? `Γεια σου <b>${name}</b>,` : `Hi <b>${name}</b>,`)}
        <div style="margin:0 0 20px;padding:16px 20px;background:#F7F5F0;border-left:3px solid ${TERRA};border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:15px;font-family:${SAN};color:${TEXT_BODY};line-height:1.6;font-style:italic;">"${prompt}"</p>
        </div>
        ${ep(isEl
    ? "Άνοιξε τον Oli — η ερώτηση θα σταλεί αυτόματα."
    : "Open Oli — the question will send automatically.")}
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0 4px;">
          <tr><td style="background:${GREEN};border-radius:10px;">
            <a href="${deepLink}" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-family:${SAN};font-size:15px;font-weight:600;">${isEl ? "Ρώτα τον Oli →" : "Ask Oli →"}</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="background:${FOOTER_BG};border-radius:0 0 16px 16px;border:1px solid ${BORDER};border-top:none;padding:16px 32px;">
        <p style="margin:0;font-size:11.5px;font-family:${SAN};color:${TEXT_MUTED};line-height:1.5;">
          ${isEl ? "Αυτό το email στάλθηκε από το Oli" : "This email was sent by Oli"}&nbsp;·&nbsp;<a href="${APP_URL}/legal/privacy" style="color:${TEXT_MUTED};text-decoration:none;">${isEl ? "Απόρρητο" : "Privacy"}</a>&nbsp;·&nbsp;<a href="${APP_URL}/profile" style="color:${TEXT_MUTED};text-decoration:none;">${isEl ? "Ρυθμίσεις ειδοποιήσεων" : "Notification settings"}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}

// ── Crop-specific engagement prompts ──

type PromptEntry = { en: string; el: string };

const CROP_PROMPTS: Record<string, PromptEntry[]> = {
  olive: [
    {
      en: "How are your olive trees looking this week? Any signs of olive fly, peacock spot, or other issues?",
      el: "Πώς φαίνονται οι ελιές σου αυτή την εβδομάδα; Υπάρχουν σημάδια από δάκο, κυκλοκόνιο ή άλλα προβλήματα;",
    },
    {
      en: "Any new yellowing, spotting, or pest activity on your olive trees this week?",
      el: "Βλέπεις νέα κιτρίνισμα, κηλίδες ή εντομολογική δραστηριότητα στις ελιές σου αυτή την εβδομάδα;",
    },
  ],
  vine: [
    {
      en: "How are your vines developing this week? Any powdery mildew, downy mildew, or grape berry moth concerns?",
      el: "Πώς εξελίσσονται τα αμπέλια σου αυτή την εβδομάδα; Βλέπεις ωίδιο, περονόσπορο ή ευδεμίδα;",
    },
    {
      en: "Any spots, cankers, or pest pressure on your grapevines this week?",
      el: "Υπάρχουν κηλίδες, νέκρωση βλαστών ή εντομολογικές προσβολές στα αμπέλια σου αυτή την εβδομάδα;",
    },
  ],
  citrus: [
    {
      en: "How are your citrus trees this week? Any yellowing leaves, sooty mold, or new pest damage?",
      el: "Πώς είναι τα εσπεριδοειδή σου αυτή την εβδομάδα; Υπάρχει κιτρίνισμα φύλλων, καπνιά ή νέα βλάβη από παράσιτα;",
    },
  ],
  tomato: [
    {
      en: "How are your tomatoes coming along? Any signs of early blight, late blight, or spider mites this week?",
      el: "Πώς πάνε οι τομάτες σου; Βλέπεις εναλτερνάρια, φυτόφθορα ή τετράνυχους αυτή την εβδομάδα;",
    },
  ],
  pepper: [
    {
      en: "How are your pepper plants looking this week? Any wilting, spots, or aphid infestations to check?",
      el: "Πώς φαίνονται τα πιπεριές σου αυτή την εβδομάδα; Υπάρχει μαρασμός, κηλίδες ή αφίδες που να ανησυχούν;",
    },
  ],
  potato: [
    {
      en: "How are your potato plants developing? Any late blight symptoms or Colorado beetle activity this week?",
      el: "Πώς εξελίσσονται οι πατάτες σου; Βλέπεις φυτόφθορα ή χρυσομηλίδα αυτή την εβδομάδα;",
    },
  ],
  wheat: [
    {
      en: "How is your wheat looking this week? Any signs of rust, powdery mildew, or aphid pressure?",
      el: "Πώς φαίνεται το σιτάρι σου αυτή την εβδομάδα; Βλέπεις σκωρίαση, ωίδιο ή αφίδες;",
    },
  ],
};

const GENERIC_PROMPTS: PromptEntry[] = [
  {
    en: "How are your crops looking this week? Any new concerns — spots, wilting, pest damage, or discoloration?",
    el: "Πώς φαίνονται οι καλλιέργειές σου αυτή την εβδομάδα; Υπάρχουν νέα προβλήματα — κηλίδες, μαρασμός, εντομολογική ζημιά ή αλλαγή χρώματος;",
  },
  {
    en: "Anything unusual on your farm this week? Send me a photo and I'll diagnose it.",
    el: "Κάτι ασυνήθιστο στο χωράφι σου αυτή την εβδομάδα; Στείλε μου μια φωτογραφία και θα το διαγνώσω.",
  },
  {
    en: "How are your plants doing? Any pest pressure, disease symptoms, or fertilization questions this week?",
    el: "Πώς πάνε τα φυτά σου; Υπάρχει εντομολογική πίεση, συμπτώματα ασθένειας ή ερωτήσεις λίπανσης αυτή την εβδομάδα;",
  },
];

function pickPrompt(primaryCrop: string | null, lang: string): string {
  const crop = (primaryCrop ?? "").toLowerCase();
  let entries: PromptEntry[] | undefined;

  for (const key of Object.keys(CROP_PROMPTS)) {
    if (crop.includes(key)) {
      entries = CROP_PROMPTS[key];
      break;
    }
  }

  const pool = entries ?? GENERIC_PROMPTS;
  const entry = pool[Math.floor(Math.random() * pool.length)];
  return (lang === "el" && entry.el) ? entry.el : entry.en;
}

// ── Auth users listing (same as send-email) ──
async function listAllAuthUsers(supabase: ReturnType<typeof createClient>) {
  const allUsers: Array<{ id: string; email?: string | null }> = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    allUsers.push(...data.users.map((u) => ({ id: u.id, email: u.email })));
    if (data.users.length < 1000) break;
    page++;
  }
  return allUsers;
}

// ── Main handler ──
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const headers = { "Content-Type": "application/json" };

    if (body.mode === "engagement_cron") {
      // Auth: CRON_SECRET in body, or x-cron-secret header, or service role bearer.
      const cronHeader = req.headers.get("x-cron-secret") || "";
      const cronBody = typeof body.cron_secret === "string" ? body.cron_secret : "";
      const authHeader = req.headers.get("authorization") || "";
      const validSR = SUPABASE_SERVICE_ROLE_KEY && authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
      const validCS = CRON_SECRET && (cronHeader === CRON_SECRET || cronBody === CRON_SECRET);
      if (!validSR && !validCS) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      // Find users active in the last 30 days
      const { data: activeUserIds } = await supabase
        .from("chat_messages")
        .select("user_id")
        .gte("created_at", thirtyDaysAgo);

      if (!activeUserIds || activeUserIds.length === 0) {
        return new Response(JSON.stringify({ sent_push: 0, sent_email: 0, reason: "no_active_users" }), { headers });
      }

      const uniqueIds = [...new Set(activeUserIds.map((r) => r.user_id as string))];

      const { data: users } = await supabase
        .from("users")
        .select("id, name, auth_id, language, primary_crop")
        .in("id", uniqueIds);

      if (!users || users.length === 0) {
        return new Response(JSON.stringify({ sent_push: 0, sent_email: 0, reason: "no_users_found" }), { headers });
      }

      const authUsers = await listAllAuthUsers(supabase);

      const MAX_EMAILS_PER_RUN = 80; // reserve 20/day for transactional (VIO, welcome, trial)
      let sentPush = 0;
      let sentEmail = 0;

      for (const u of users) {
        const lang = (u.language as string | null) ?? "en";
        const prompt = pickPrompt(u.primary_crop as string | null, lang);
        const encodedPrompt = encodeURIComponent(prompt);
        const deepLink = `${APP_URL}/chat?prompt=${encodedPrompt}`;

        // Try push first
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("id, endpoint")
          .eq("user_id", u.id);

        let pushedThisUser = false;
        for (const sub of (subs || [])) {
          const ok = await sendSilentPush(sub.endpoint as string);
          if (ok) {
            pushedThisUser = true;
            await supabase
              .from("push_subscriptions")
              .update({ last_pushed_at: new Date().toISOString() })
              .eq("id", sub.id);
          } else {
            // Subscription expired — clean it up
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }

        if (pushedThisUser) {
          sentPush++;
          continue; // push sent — skip email for this user
        }

        // Fall back to email
        if (sentEmail >= MAX_EMAILS_PER_RUN) continue;
        const authUser = authUsers.find((a) => a.id === u.auth_id);
        if (!authUser?.email) continue;

        const name = (u.name as string | null) || (lang === "el" ? "Αγρότη" : "Farmer");
        const tpl = engagementEmail({ name, lang, prompt, deepLink });
        const ok = await sendEmail(authUser.email, tpl.subject, tpl.html);
        if (ok) sentEmail++;
      }

      return new Response(
        JSON.stringify({
          sent_push: sentPush,
          sent_email: sentEmail,
          total_active: uniqueIds.length,
          email_cap_reached: sentEmail >= MAX_EMAILS_PER_RUN,
        }),
        { headers },
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid mode. Use: engagement_cron" }),
      { status: 400, headers },
    );
  } catch (e) {
    console.error("send-weekly-engagement error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
