import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_TIERS = ['pro', 'master'];
const MAX_DAYS    = 365;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── 1. Auth: verify caller JWT ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS });

    // Use anon client scoped to the caller's JWT to get their identity
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) return new Response('Unauthorized', { status: 401, headers: CORS });

    // ── 2. Admin check: must be in admin_users table (server-side) ──────────
    // Use service role to check admin_users — anon cannot read it
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: adminRow } = await serviceClient
      .from('admin_users')
      .select('id')
      .eq('auth_id', caller.id)
      .maybeSingle();
    if (!adminRow) return new Response('Forbidden', { status: 403, headers: CORS });

    // ── 3. Parse & validate payload ─────────────────────────────────────────
    const { email, tier, days, note } = await req.json() as {
      email: string;
      tier: string;
      days: number;
      note?: string;
    };

    if (!email || typeof email !== 'string' || !email.includes('@'))
      return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: CORS });

    if (!VALID_TIERS.includes(tier))
      return new Response(JSON.stringify({ error: 'Invalid tier. Must be pro or master.' }), { status: 400, headers: CORS });

    const safeDays = Math.min(Math.max(Number(days) || 30, 1), MAX_DAYS);

    // ── 4. Look up the target user by email ─────────────────────────────────
    const { data: targetUsers, error: lookupErr } = await serviceClient
      .from('users')
      .select('id, email, tier')
      .eq('email', email.toLowerCase().trim())
      .limit(1);

    if (lookupErr || !targetUsers || targetUsers.length === 0)
      return new Response(JSON.stringify({ error: 'User not found with that email.' }), { status: 404, headers: CORS });

    const target = targetUsers[0];

    // ── 5. Apply the tier grant ─────────────────────────────────────────────
    const grantedUntil = new Date();
    grantedUntil.setDate(grantedUntil.getDate() + safeDays);

    const { error: updateErr } = await serviceClient
      .from('users')
      .update({
        tier,
        tier_source: 'manual',
        tier_expires_at: grantedUntil.toISOString(),
        billing_period: null,           // not a recurring subscription
      })
      .eq('id', target.id);

    if (updateErr) throw updateErr;

    // ── 6. Audit log ────────────────────────────────────────────────────────
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
