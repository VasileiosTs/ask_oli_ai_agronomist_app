// Oli Push Notification Edge Function
// Sends web push notifications to users for VIO follow-ups and alerts
// Called by cron job or directly for individual notifications

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@askoli.ai";

// ── Web Push crypto helpers (using Web Crypto API) ──

async function generateJWT(header: object, payload: object, privateKeyRaw: string): Promise<string> {
  const enc = new TextEncoder();

  // Import VAPID private key (base64url → ECDSA P-256)
  const padding = "=".repeat((4 - (privateKeyRaw.length % 4)) % 4);
  const b64 = (privateKeyRaw + padding).replace(/-/g, "+").replace(/_/g, "/");
  const keyBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    buildPkcs8(keyBytes),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const sigInput = enc.encode(`${headerB64}.${payloadB64}`);

  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, sigInput);
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

function buildPkcs8(rawKey: Uint8Array): ArrayBuffer {
  // Wrap raw 32-byte private key in PKCS#8 DER for P-256
  const prefix = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20
  ]);
  const suffix = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00
  ]);
  // For this simplified version, we just need the raw key
  const result = new Uint8Array(prefix.length + rawKey.length + suffix.length + 65);
  result.set(prefix, 0);
  result.set(rawKey, prefix.length);
  // We'll skip the public key part and use a simpler approach
  return result.buffer.slice(0, prefix.length + rawKey.length);
}

// Simplified push sender using fetch with VAPID auth
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object
): Promise<boolean> {
  try {
    const audience = new URL(subscription.endpoint).origin;
    const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

    const jwt = await generateJWT(
      { typ: "JWT", alg: "ES256" },
      { aud: audience, exp: expiry, sub: VAPID_SUBJECT },
      VAPID_PRIVATE_KEY
    );

    const resp = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "TTL": "86400",
        "Authorization": `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (resp.status === 410 || resp.status === 404) {
      // Subscription expired/invalid — clean up
      return false;
    }

    return resp.ok;
  } catch (e) {
    console.error("Push send error:", e);
    return false;
  }
}

// ── CORS ──
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    // Mode 1: Send to specific user
    if (body.user_id && body.title) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", body.user_id);

      if (!subs || subs.length === 0) {
        return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      let sent = 0;
      for (const sub of subs) {
        const ok = await sendPushNotification(sub, {
          title: body.title,
          body: body.body || "",
          url: body.url || "/chat",
          tag: body.tag || "oli-vio",
        });
        if (ok) sent++;
        else {
          // Remove invalid subscription
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }

      return new Response(JSON.stringify({ sent }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Mode 2: VIO cron — find all due follow-ups and send reminders
    if (body.mode === "vio_cron") {
      const now = new Date().toISOString();
      const { data: dueInterventions } = await supabase
        .from("interventions")
        .select("id, user_id, crop_type, problem, vio_step")
        .lte("follow_up_at", now)
        .is("outcome", null)
        .lt("vio_step", 3);

      if (!dueInterventions || dueInterventions.length === 0) {
        return new Response(JSON.stringify({ processed: 0 }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      let processed = 0;
      for (const iv of dueInterventions) {
        const step = iv.vio_step ?? 1;
        const title = "Oli";
        const msgBody = step <= 1
          ? `Did you apply the treatment for ${iv.problem || iv.crop_type || "your crop"}?`
          : `Any improvement with ${iv.problem || iv.crop_type || "your crop"}?`;

        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", iv.user_id);

        for (const sub of (subs || [])) {
          const ok = await sendPushNotification(sub, {
            title,
            body: msgBody,
            url: "/chat",
            tag: `vio-${iv.id}`,
          });
          if (!ok) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
        processed++;
      }

      return new Response(JSON.stringify({ processed }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid request. Provide user_id+title or mode=vio_cron" }), {
      status: 400,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
