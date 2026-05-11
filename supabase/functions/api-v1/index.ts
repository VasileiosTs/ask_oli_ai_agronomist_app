// deno-lint-ignore-file no-explicit-any
/**
 * Oli Public API – v1
 *
 * Authentication: Bearer token in Authorization header.
 * The token is a raw API key issued via the Profile page (master / enterprise tiers).
 * We SHA-256 hash it and compare against api_keys.key_hash.
 *
 * Endpoints:
 *   GET  /api-v1/diagnoses          – list recent diagnoses for the key owner
 *   GET  /api-v1/diagnoses/:id      – single diagnosis + outcome
 *   GET  /api-v1/outcomes           – list intervention outcomes
 *   POST /api-v1/keys               – generate a new API key (Supabase JWT required)
 *   DELETE /api-v1/keys/:id         – revoke a key (Supabase JWT required)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ALLOWED_ORIGINS = new Set([
  Deno.env.get('ALLOWED_ORIGIN') || 'https://ask-oli.com',
  'https://www.ask-oli.com',
  'https://ask-oli.com',
]);

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get('origin') || '';
  // Key management routes: restrict to production domain + localhost dev
  // Data endpoints: allow any origin (public API, used by third-party integrations)
  return origin;
}

function json(body: unknown, status = 200, req?: Request, restrictOrigin = false) {
  const origin = req ? getCorsOrigin(req) : '*';
  const allowedOrigin = restrictOrigin
    ? (ALLOWED_ORIGINS.has(origin) || origin.startsWith('http://localhost') ? origin : 'https://ask-oli.com')
    : '*';
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin },
  });
}

function err(message: string, status = 400, req?: Request, restrictOrigin = false) {
  return json({ error: message }, status, req, restrictOrigin);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Authenticate via raw API key. Returns the api_keys row + user_id, or null. */
async function authenticateApiKey(
  supabase: ReturnType<typeof createClient>,
  authHeader: string | null,
): Promise<{ userId: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) return null;

  const hash = await sha256Hex(rawKey);

  const { data } = await supabase
    .from('api_keys')
    .select('user_id, revoked_at')
    .eq('key_hash', hash)
    .maybeSingle();

  if (!data || data.revoked_at) return null;

  // Update last_used_at asynchronously (fire and forget)
  supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', hash);

  return { userId: data.user_id };
}

/** Authenticate via Supabase JWT (for key management endpoints). Returns user row id or null. */
async function authenticateJwt(
  supabase: ReturnType<typeof createClient>,
  authHeader: string | null,
): Promise<{ userId: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();

  // Create a client that validates the JWT
  const userClient = createClient(SUPABASE_URL, token, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;

  const { data: row } = await supabase
    .from('users')
    .select('id, tier')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (!row) return null;
  return { userId: row.id };
}

const API_ALLOWED_TIERS = new Set(['master', 'enterprise']);

async function assertApiTier(supabase: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data } = await supabase.from('users').select('tier').eq('id', userId).maybeSingle();
  return API_ALLOWED_TIERS.has(data?.tier ?? '');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin') || '';
    const isKeyMgmt = req.url.includes('/keys');
    const allowedOrigin = isKeyMgmt
      ? (ALLOWED_ORIGINS.has(origin) || origin.startsWith('http://localhost') ? origin : 'https://ask-oli.com')
      : '*';
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const url = new URL(req.url);
  // pathname like /api-v1/diagnoses or /api-v1/keys
  const segments = url.pathname.replace(/^\/api-v1\/?/, '').split('/').filter(Boolean);
  const resource = segments[0]; // "diagnoses" | "outcomes" | "keys"
  const resourceId = segments[1]; // optional UUID

  const authHeader = req.headers.get('Authorization');

  // ── Key management endpoints (JWT auth, origin-restricted CORS) ──────────
  if (resource === 'keys') {
    const jwtAuth = await authenticateJwt(supabase, authHeader);
    if (!jwtAuth) return err('Unauthorized', 401, req, true);

    // POST /keys — create new API key
    if (req.method === 'POST') {
      const hasTier = await assertApiTier(supabase, jwtAuth.userId);
      if (!hasTier) return err('API access requires master or enterprise tier', 403);

      const body = await req.json().catch(() => ({}));
      const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'My API key';

      // Generate 32-byte random key, base64url encode it
      const rawBytes = new Uint8Array(32);
      crypto.getRandomValues(rawBytes);
      const rawKey = `oli_${btoa(String.fromCharCode(...rawBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;
      const hash = await sha256Hex(rawKey);
      const prefix = rawKey.slice(0, 12);

      const { data, error } = await supabase
        .from('api_keys')
        .insert({ user_id: jwtAuth.userId, name, key_hash: hash, key_prefix: prefix })
        .select('id, name, key_prefix, created_at')
        .single();

      if (error) return err('Failed to create API key', 500, req, true);

      // Return raw key ONCE — it cannot be retrieved again
      return json({ ...data, key: rawKey }, 201, req, true);
    }

    // DELETE /keys/:id — revoke
    if (req.method === 'DELETE' && resourceId) {
      const { error } = await supabase
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', resourceId)
        .eq('user_id', jwtAuth.userId);

      if (error) return err('Failed to revoke key', 500, req, true);
      return json({ revoked: true }, 200, req, true);
    }

    // GET /keys — list (prefix only, never hash)
    if (req.method === 'GET') {
      const { data } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, last_used_at, created_at, revoked_at')
        .eq('user_id', jwtAuth.userId)
        .order('created_at', { ascending: false });

      return json({ keys: data ?? [] }, 200, req, true);
    }

    return err('Method not allowed', 405, req, true);
  }

  // ── Data endpoints (API key auth) ─────────────────────────────────────────
  const keyAuth = await authenticateApiKey(supabase, authHeader);
  if (!keyAuth) return err('Unauthorized — provide a valid API key as Bearer token', 401);

  const { userId } = keyAuth;
  const limitParam = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
  const offsetParam = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10), 0);

  // GET /diagnoses
  if (resource === 'diagnoses' && req.method === 'GET') {
    if (resourceId) {
      // Single diagnosis
      const { data, error } = await supabase
        .from('interventions')
        .select(`
          id, problem, cause, severity, confidence_score,
          product_applied, dosage, application_method,
          organic_treatments, chemical_treatments,
          field_id, created_at,
          fields ( name, crop_type, location ),
          outcomes ( outcome, recorded_at )
        `)
        .eq('id', resourceId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) return err('Database error', 500);
      if (!data) return err('Not found', 404);
      return json(data);
    }

    // List diagnoses
    const { data, error } = await supabase
      .from('interventions')
      .select(`
        id, problem, cause, severity, confidence_score,
        product_applied, field_id, created_at,
        fields ( name, crop_type )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offsetParam, offsetParam + limitParam - 1);

    if (error) return err('Database error', 500);
    return json({ diagnoses: data ?? [], limit: limitParam, offset: offsetParam });
  }

  // GET /outcomes
  if (resource === 'outcomes' && req.method === 'GET') {
    const { data, error } = await supabase
      .from('outcomes')
      .select(`
        id, outcome, recorded_at,
        interventions!inner ( id, problem, user_id )
      `)
      .eq('interventions.user_id', userId)
      .order('recorded_at', { ascending: false })
      .range(offsetParam, offsetParam + limitParam - 1);

    if (error) return err('Database error', 500);
    return json({ outcomes: data ?? [], limit: limitParam, offset: offsetParam });
  }

  return err('Not found', 404);
});
