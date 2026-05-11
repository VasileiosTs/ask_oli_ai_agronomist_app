// supabase/functions/kpi-snapshot/index.ts
//
// Changes from original:
//  1. CORS now uses ALLOWED_ORIGIN env var (same pattern as the chat function).
//     The hardcoded 4-entry ALLOWED_ORIGINS array has been removed. Update your
//     Supabase secrets with:  ALLOWED_ORIGIN=https://your-production-domain.com
//  2. The compute_kpi_snapshot RPC call is unchanged — agronomic quality metrics
//     (avg_diagnosis_confidence, vio_outcome_rate, etc.) should be added to the
//     PL/pgSQL function itself, not here.  See TODOS.md § KPI strategy.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  Deno.env.get('ALLOWED_ORIGIN') || 'https://ask-oli.com',
  'https://www.ask-oli.com',
  'https://ask-oli.com',
]);

function getCorsHeaders(req?: Request) {
  const origin = req?.headers.get('Origin') ?? '';
  const isAllowed =
    ALLOWED_ORIGINS.has(origin) ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://ask-oli.com',
    'Access-Control-Allow-Headers': 'authorization, x-cron-secret, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Auth: either CRON_SECRET header or valid admin JWT
  const cronSecret      = req.headers.get('x-cron-secret');
  const expectedSecret  = Deno.env.get('CRON_SECRET');
  const authHeader      = req.headers.get('authorization');
  let authorized        = false;

  if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
    authorized = true;
  }

  if (!authorized && authHeader) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
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
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let targetDate: string | undefined;
  try {
    const body = await req.json();
    targetDate = body?.date;
  } catch {
    // no body is fine
  }

  const { data, error } = await supabaseAdmin.rpc('compute_kpi_snapshot', {
    target_date: targetDate ?? new Date().toISOString().split('T')[0],
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, snapshot: data }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
