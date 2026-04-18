// Oli Push Notification Edge Function
// Sends web push notifications to users for VIO follow-ups and alerts
// Called by cron job or directly for individual notifications

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@ask-oli.com";

// ── Web Push crypto helpers (using Web Crypto API) ──

function decodeBase64url(s: string): Uint8Array {
  const padding = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

/**
 * Build a valid PKCS#8 DER structure for a P-256 EC private key.
 * Requires both the raw 32-byte private key and the 65-byte uncompressed public key
 * (0x04 || x || y) — Web Crypto's importKey("pkcs8") requires the full structure.
 *
 * Outer structure (total content = 135 bytes = 0x87):
 *   SEQUENCE {
 *     INTEGER 0
 *     SEQUENCE { OID ecPublicKey, OID P-256 }
 *     OCTET STRING {
 *       SEQUENCE (ECPrivateKey, RFC 5915) {
 *         INTEGER 1
 *         OCTET STRING { [32 bytes raw private key] }
 *         [1] { BIT STRING { 0x00, [65 bytes public key] } }
 *       }
 *     }
 *   }
 */
function buildPkcs8(rawPrivKey: Uint8Array, rawPubKey: Uint8Array): ArrayBuffer {
  const prefix = new Uint8Array([
    0x30, 0x81, 0x87, // SEQUENCE (135 bytes)
    0x02, 0x01, 0x00, // INTEGER 0
    0x30, 0x13,       // SEQUENCE (19 bytes) — algorithm identifier
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID ecPublicKey
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID P-256
    0x04, 0x6d,       // OCTET STRING (109 bytes)
    0x30, 0x6b,       // SEQUENCE (107 bytes) — ECPrivateKey
    0x02, 0x01, 0x01, // INTEGER 1
    0x04, 0x20,       // OCTET STRING (32 bytes) — private key
  ]);
  const midfix = new Uint8Array([
    0xa1, 0x44,       // CONTEXT [1] (68 bytes)
    0x03, 0x42, 0x00, // BIT STRING (66 bytes, 0 unused bits)
  ]);
  const result = new Uint8Array(prefix.length + 32 + midfix.length + 65);
  result.set(prefix);
  result.set(rawPrivKey.slice(0, 32), prefix.length);
  result.set(midfix, prefix.length + 32);
  result.set(rawPubKey.slice(0, 65), prefix.length + 32 + midfix.length);
  return result.buffer;
}

async function generateJWT(header: object, payload: object, privateKeyRaw: string, publicKeyRaw: string): Promise<string> {
  const enc = new TextEncoder();

  const privKeyBytes = decodeBase64url(privateKeyRaw); // 32 bytes
  const pubKeyBytes = decodeBase64url(publicKeyRaw);   // 65 bytes (0x04 || x || y)

  const key = await crypto.subtle.importKey(
    "pkcs8",
    buildPkcs8(privKeyBytes, pubKeyBytes),
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

// Send a VAPID-authenticated ping (no body) to the push endpoint.
// Payload encryption (RFC 8291) is intentionally omitted: a silent push is
// reliable across all push services and the service worker shows a helpful
// default notification. Specific VIO details are visible in-app via the banner.
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
): Promise<boolean> {
  try {
    const audience = new URL(subscription.endpoint).origin;
    const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

    const jwt = await generateJWT(
      { typ: "JWT", alg: "ES256" },
      { aud: audience, exp: expiry, sub: VAPID_SUBJECT },
      VAPID_PRIVATE_KEY,
      VAPID_PUBLIC_KEY,
    );

    const resp = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "TTL": "86400",
        "Authorization": `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      },
      // No body — silent push; service worker shows notification with default text
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
const ALLOWED_ORIGIN =
  Deno.env.get("ALLOWED_ORIGIN") || "https://codex-ask-oli-app.vercel.app";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const isAllowed =
    origin === ALLOWED_ORIGIN ||
    origin === "http://localhost:5173" ||
    origin === "http://localhost:3000";
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

async function logOperationalEvent(
  supabase: ReturnType<typeof createClient>,
  {
    userId,
    eventType,
    severity = "error",
    message,
    metadata,
  }: {
    userId?: string | null;
    eventType: string;
    severity?: "info" | "warning" | "error" | "critical";
    message: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("operational_events").insert({
    user_id: userId ?? null,
    source: "send-push",
    event_type: eventType,
    severity,
    message,
    metadata: metadata ?? {},
  });
}

// Max push notifications per user per hour
const PUSH_RATE_LIMIT = 10;
// Max subscriptions per user
const MAX_SUBSCRIPTIONS_PER_USER = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    // Mode 1: Send to specific user — requires service role key (internal use only)
    if (body.user_id && body.title) {
      const authHeader = req.headers.get("authorization") || "";
      if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      // Validate push fields
      const title = typeof body.title === "string" ? body.title.slice(0, 100) : "";
      const pushBody = typeof body.body === "string" ? body.body.slice(0, 500) : "";
      const pushUrl = typeof body.url === "string" && /^\/[a-zA-Z0-9\-_/]*$/.test(body.url) ? body.url : "/chat";

      if (!title) {
        return new Response(JSON.stringify({ error: "title is required and must be a non-empty string" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Per-user push rate limit: max PUSH_RATE_LIMIT direct pushes per user per hour.
      // We track this via push_subscriptions.last_pushed_at — if it was updated within
      // the last hour more than PUSH_RATE_LIMIT times we skip. Since we don't have a
      // notifications_sent table, we enforce a simpler check: if the user's most recent
      // subscription was last_pushed_at within the past hour, count how many subscriptions
      // have been pushed recently and skip if over the limit.
      // Note: cron-mode (vio_cron) runs at most every 6h and is inherently rate-limited.
      // This rate limit applies only to direct-mode calls (from the chat function).
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { count: recentPushCount } = await supabase
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", body.user_id)
        .gte("last_pushed_at", oneHourAgo);

      if ((recentPushCount ?? 0) >= PUSH_RATE_LIMIT) {
        return new Response(JSON.stringify({ sent: 0, reason: "rate_limited" }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

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
      const now = new Date().toISOString();
      for (const sub of subs) {
        const ok = await sendPushNotification(sub);
        if (ok) {
          sent++;
          // Track send time for rate limiting
          await supabase.from("push_subscriptions").update({ last_pushed_at: now }).eq("id", sub.id);
        } else {
          await logOperationalEvent(supabase, {
            userId: body.user_id,
            eventType: "push_delivery_failed",
            severity: "warning",
            message: "Direct push delivery failed and the subscription was removed",
            metadata: {
              subscriptionId: sub.id,
              endpoint: sub.endpoint,
            },
          });
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

        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", iv.user_id);

        let notificationSent = 0;
        for (const sub of (subs || [])) {
          const ok = await sendPushNotification(sub);
          if (ok) {
            notificationSent++;
          } else {
            await logOperationalEvent(supabase, {
              userId: iv.user_id,
              eventType: "push_delivery_failed",
              severity: "warning",
              message: "Scheduled VIO push delivery failed and the subscription was removed",
              metadata: {
                interventionId: iv.id,
                subscriptionId: sub.id,
                endpoint: sub.endpoint,
              },
            });
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }

        // Advance VIO step only if we actually delivered a push notification.
        // If user has no push subscriptions, the email cron (30min offset) picks it up.
        // This prevents double-notification while also avoiding infinite cron loops.
        if (notificationSent > 0) {
          const nextStep = step + 1;
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await logOperationalEvent(supabase, {
      eventType: "push_function_error",
      severity: "error",
      message: "send-push function crashed",
      metadata: {
        error: (e as Error).message,
      },
    });
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
