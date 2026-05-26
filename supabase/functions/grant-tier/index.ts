import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_TIERS = ['pro', 'master'];
const MAX_DAYS    = 365;

async function verifyAdmin(authHeader: string) {
  // Step 1: identify caller from their JWT
  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user: caller }, error } = await callerClient.auth.getUser();
  if (error || !caller) return null;

  // Step 2: confirm they are in admin_users — checked server-side via service role
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: adminRow } = await serviceClient
    .from('admin_users')
    .select('id')
    .eq('auth_id', caller.id)
    .maybeSingle();

  if (!adminRow) return null;
  return { caller, serviceClient };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS });

  try {
    const auth = await verifyAdmin(authHeader);
    if (!auth) return new Response('Forbidden', { status: 403, headers: CORS });

    const { caller, serviceClient } = auth;

    // ── GET: return audit log ───────────────────────────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await serviceClient
        .from('manual_grants')
        .select('id, granted_to_email, granted_by_user_id, tier, days, granted_until, note, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return new Response(JSON.stringify(data ?? []), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── POST: grant a tier ──────────────────────────────────────────────────
    if (req.method !== 'POST')
      return new Response('Method Not Allowed', { status: 405, headers: CORS });

    const { email, tier, days, note } = await req.json() as {
      email: string; tier: string; days: number; note?: string;
    };

    // Validate inputs
    if (!email || typeof email !== 'string' || !email.includes('@'))
      return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: CORS });
    if (!VALID_TIERS.includes(tier))
      return new Response(JSON.stringify({ error: 'Invalid tier. Must be pro or master.' }), { status: 400, headers: CORS });

    const safeDays = Math.min(Math.max(Number(days) || 30, 1), MAX_DAYS);

    // Look up target user
    const { data: targetUsers, error: lookupErr } = await serviceClient
      .from('users')
      .select('id, email, tier')
      .eq('email', email.toLowerCase().trim())
      .limit(1);

    if (lookupErr || !targetUsers || targetUsers.length === 0)
      return new Response(JSON.stringify({ error: 'No user found with that email.' }), { status: 404, headers: CORS });

    const target = targetUsers[0];

    // Apply grant
    const grantedUntil = new Date();
    grantedUntil.setDate(grantedUntil.getDate() + safeDays);

    const { error: updateErr } = await serviceClient
      .from('users')
      .update({
        tier,
        tier_source: 'manual',
        tier_expires_at: grantedUntil.toISOString(),
        billing_period: null,
      })
      .eq('id', target.id);

    if (updateErr) throw updateErr;

    // Audit log
    await serviceClient.from('manual_grants').insert({
      granted_to_user_id: target.id,
      granted_to_email:   email.toLowerCase().trim(),
      granted_by_user_id: caller.id,
      tier,
      days: safeDays,
      granted_until: grantedUntil.toISOString(),
      note: note ?? null,
    });

    return new Response(JSON.stringify({
      ok: true,
      email: target.email,
      tier,
      days: safeDays,
      granted_until: grantedUntil.toISOString(),
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('grant-tier error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: CORS });
  }
});
