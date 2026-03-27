import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://codex-ask-oli-app.vercel.app',
  'http://localhost:5173',
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-cron-secret, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  // Auth: either CRON_SECRET header or valid admin JWT
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('authorization');

  let authorized = false;

  // Check cron secret
  if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
    authorized = true;
  }

  // Check admin JWT
  if (!authorized && authHeader) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: admin } = await supabase
        .from('admin_users')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle();
      if (admin) authorized = true;
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  // Use service_role to call the PL/pgSQL function
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Optional: accept a target_date in body
  let targetDate: string | undefined;
  try {
    const body = await req.json();
    targetDate = body?.date;
  } catch {
    // no body is fine
  }

  const { data, error } = await supabaseAdmin.rpc('compute_kpi_snapshot', {
    target_date: targetDate || new Date().toISOString().split('T')[0],
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, snapshot: data }), {
    status: 200,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
});
