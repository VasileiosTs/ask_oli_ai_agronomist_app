// Oli Proactive Alerts — daily weather-aware field notifications
// Called by pg_cron at 06:00 UTC every day.
// Only fires for Pro / Master / Enterprise users with active fields + push subscriptions.
// Uses Gemini to reason per-field: crop + location + weather + season → alert or not.
// Stores each alert in field_alerts so users can see it in-app even if they miss the push.
// Cool-down: max 1 alert per field per 72 hours (enforced via last_proactive_alert_at).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

// ── Tiers eligible for proactive alerts ──
const PROACTIVE_TIERS = new Set(["pro", "master", "enterprise"]);

// ── Cool-down: 72 hours between alerts per field ──
const COOLDOWN_HOURS = 72;

// ── Only act on medium/high severity alerts ──
const ALERT_SEVERITIES = new Set(["medium", "high"]);

// ── Gemini model for alert reasoning ──
const GEMINI_MODEL = "gemini-2.0-flash";

interface GeminiAlertResponse {
  should_alert: boolean;
  message: string;
  severity: "low" | "medium" | "high";
  reason: string;
}

interface WeatherData {
  temperature_c: number;
  humidity_pct: number;
  wind_kmh: number;
  precipitation_mm: number;
  forecast: Array<{
    date: string;
    max_temp: number;
    min_temp: number;
    precipitation_mm: number;
  }>;
}

async function fetchWeatherForecast(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&forecast_days=7&timezone=auto`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!resp.ok) return null;
    const d = await resp.json();

    return {
      temperature_c: Math.round(d.current?.temperature_2m ?? 0),
      humidity_pct: Math.round(d.current?.relative_humidity_2m ?? 0),
      wind_kmh: Math.round(d.current?.wind_speed_10m ?? 0),
      precipitation_mm: d.current?.precipitation ?? 0,
      forecast: (d.daily?.time ?? []).slice(0, 7).map((date: string, i: number) => ({
        date,
        max_temp: Math.round(d.daily.temperature_2m_max[i] ?? 0),
        min_temp: Math.round(d.daily.temperature_2m_min[i] ?? 0),
        precipitation_mm: d.daily.precipitation_sum[i] ?? 0,
      })),
    };
  } catch {
    return null;
  }
}

function buildWeatherSummary(w: WeatherData): string {
  const forecast = w.forecast
    .map(d => `${d.date}: ${d.min_temp}–${d.max_temp}°C, ${d.precipitation_mm}mm rain`)
    .join(" | ");
  return `Current: ${w.temperature_c}°C, ${w.humidity_pct}% humidity, ${w.wind_kmh}km/h wind\n7-day: ${forecast}`;
}

async function callGeminiForAlert(
  fieldProfile: {
    name: string;
    crop_type: string | null;
    location: string | null;
    soil_type: string | null;
    last_diagnosis: string | null;
    intervention_count: number | null;
  },
  weather: WeatherData,
  month: string,
  season: string,
): Promise<GeminiAlertResponse | null> {
  const systemPrompt = `You are Oli, an expert AI agronomist monitoring a farmer's field. Based on the field profile and upcoming weather, determine if there is a genuinely time-sensitive agronomic action the farmer must take in the next 1-5 days.

ALERT CRITERIA — only alert when ALL of these are true:
1. The specific crop has a known, documented risk from the upcoming weather pattern
2. The action must be taken within the next 1-5 days to be effective (timing is critical)
3. Missing this window causes measurable crop damage or disease establishment
4. The risk is realistic for this crop, season, and climate

DO NOT alert for:
- General seasonal advice not triggered by specific weather
- Low-probability risks
- Situations where the farmer has a 2+ week window to act
- Generic care reminders ("time to fertilize") not linked to weather
- Any situation where you are uncertain

Be conservative. A bad alert teaches farmers to ignore all alerts. If in doubt, do not alert.

Reply with valid JSON only:
{
  "should_alert": boolean,
  "message": "1-2 sentences, specific to this crop and weather, action-oriented",
  "severity": "low|medium|high",
  "reason": "internal reasoning, not shown to user"
}`;

  const userContent = `Field: ${fieldProfile.name}
Crop: ${fieldProfile.crop_type || "unknown"}
Location: ${fieldProfile.location || "unknown"}
Soil: ${fieldProfile.soil_type || "unknown"}
Last issue: ${fieldProfile.last_diagnosis || "none recorded"}
Month: ${month} (${season})

Weather:
${buildWeatherSummary(weather)}`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userContent }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                should_alert: { type: "BOOLEAN" },
                message: { type: "STRING" },
                severity: { type: "STRING", enum: ["low", "medium", "high"] },
                reason: { type: "STRING" },
              },
              required: ["should_alert", "message", "severity", "reason"],
            },
            temperature: 0.2,
            maxOutputTokens: 256,
          },
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );

    if (!resp.ok) return null;
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text) as GeminiAlertResponse;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
    const now = new Date();
    const month = now.toLocaleString("en-US", { month: "long" });
    const monthNum = now.getMonth() + 1;
    const season =
      monthNum >= 3 && monthNum <= 5 ? "spring" :
      monthNum >= 6 && monthNum <= 8 ? "summer" :
      monthNum >= 9 && monthNum <= 11 ? "autumn" : "winter";

    // Find all fields belonging to eligible-tier users, with location data,
    // that haven't received a proactive alert within the cool-down window.
    const { data: fields } = await supabase
      .from("fields")
      .select(`
        id, name, user_id, crop_type, location, location_lat, location_lon,
        soil_type, last_diagnosis, intervention_count,
        last_proactive_alert_at,
        users!inner (id, tier)
      `)
      .not("location_lat", "is", null)
      .not("location_lon", "is", null)
      .not("crop_type", "is", null)
      .or(`last_proactive_alert_at.is.null,last_proactive_alert_at.lt.${cooldownCutoff}`);

    if (!fields || fields.length === 0) {
      return new Response(JSON.stringify({ processed: 0, alerted: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Filter to eligible tiers
    const eligibleFields = fields.filter((f: { users: { tier: string } }) =>
      PROACTIVE_TIERS.has(f.users?.tier)
    );

    let processed = 0;
    let alerted = 0;

    for (const field of eligibleFields) {
      processed++;

      const weather = await fetchWeatherForecast(field.location_lat, field.location_lon);
      if (!weather) continue;

      const alertResult = await callGeminiForAlert(
        {
          name: field.name,
          crop_type: field.crop_type,
          location: field.location,
          soil_type: field.soil_type,
          last_diagnosis: field.last_diagnosis,
          intervention_count: field.intervention_count,
        },
        weather,
        month,
        season,
      );

      if (!alertResult || !alertResult.should_alert || !ALERT_SEVERITIES.has(alertResult.severity)) {
        // Still update the timestamp to reset cool-down even when no alert is needed
        // (prevents checking the same field every single day with identical conditions)
        await supabase
          .from("fields")
          .update({ last_proactive_alert_at: new Date().toISOString() })
          .eq("id", field.id);
        continue;
      }

      // 1. Store alert in DB (user can see it in-app)
      await supabase.from("field_alerts").insert({
        user_id: field.user_id,
        field_id: field.id,
        message: alertResult.message,
        severity: alertResult.severity,
        source: "proactive",
      });

      // 2. Send silent push notification (user sees generic prompt to check app)
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", field.user_id);

      if (subs && subs.length > 0) {
        // Fire-and-forget internal call to send-push direct mode
        // Using the existing service-role-authenticated path
        fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            user_id: field.user_id,
            title: "Oli — Field Alert",
            body: alertResult.message,
            url: `/fields/${field.id}`,
          }),
        }).catch(() => {});
      }

      // 3. Update cool-down timestamp
      await supabase
        .from("fields")
        .update({ last_proactive_alert_at: new Date().toISOString() })
        .eq("id", field.id);

      alerted++;
    }

    return new Response(JSON.stringify({ processed, alerted }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("proactive-alerts error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
