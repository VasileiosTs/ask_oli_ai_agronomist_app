// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://codex-ask-oli-app.vercel.app';

function getCorsHeaders(req?: Request) {
  const origin = req?.headers.get('Origin') || '';
  const isAllowed =
    origin === ALLOWED_ORIGIN ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = requiredEnv('GEMINI_API_KEY');
    const ALLOWED_GEMINI_MODELS = ['gemini-2.5-flash','gemini-2.5-pro','gemini-2.0-flash','gemini-2.0-pro','gemini-1.5-flash','gemini-1.5-pro'];
    const _rawModel = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
    const geminiModel = ALLOWED_GEMINI_MODELS.includes(_rawModel) ? _rawModel : 'gemini-2.5-flash';

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });
    }
    const token = authHeader.slice(7);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });
    }

    // Fetch user profile
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('name, location, primary_crop, language')
      .eq('auth_id', user.id)
      .single();

    if (!profile?.primary_crop) {
      return new Response(JSON.stringify({ greeting: null }), { headers: cors });
    }

    const body = await req.json().catch(() => ({}));
    const lang = profile.language ?? body.lang ?? 'en';
    const tz = body.timezone || 'UTC';
    const locale = lang === 'el' ? 'el-GR' : 'en-GB';
    const month = new Date().toLocaleString(locale, { month: 'long', timeZone: tz });
    const firstName = profile.name?.split(' ')[0] ?? '';
    const loc = profile.location || '';

    const prompt = lang === 'el'
      ? `Είσαι ο Oli, AI γεωπόνος. Γράψε ΕΝΑ σύντομο εποχιακό χαιρετισμό (1-2 προτάσεις, max 30 λέξεις) για αγρότη${firstName ? ` που λέγεται ${firstName}` : ''} που καλλιεργεί: ${profile.primary_crop}.${loc ? ` Τοποθεσία: ${loc}.` : ''} Μήνας: ${month}. Δώσε ΜΙΑ συγκεκριμένη αγρονομική συμβουλή ή προειδοποίηση που αφορά ΑΥΤΗ ακριβώς την καλλιέργεια αυτή την εποχή. Μόνο κείμενο, χωρίς JSON.`
      : `You are Oli, an AI agronomist. Write ONE short seasonal greeting (1-2 sentences, max 30 words) for a farmer${firstName ? ` named ${firstName}` : ''} growing: ${profile.primary_crop}.${loc ? ` Location: ${loc}.` : ''} Month: ${month}. Give ONE specific agronomic tip or warning relevant to THIS crop at this time of year. Plain text only, no JSON.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 80 },
        }),
      }
    );

    if (!response.ok) {
      return new Response(JSON.stringify({ greeting: null }), { headers: cors });
    }

    const data = await response.json();
    const greeting = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;

    return new Response(
      JSON.stringify({ greeting }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('greeting error:', err);
    return new Response(JSON.stringify({ greeting: null }), { headers: getCorsHeaders(req) });
  }
});
