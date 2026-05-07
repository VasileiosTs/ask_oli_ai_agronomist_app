import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://ask-oli.com';

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
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

async function listUserUploads(supabaseAdmin: ReturnType<typeof createClient>, authUserId: string) {
  const allPaths: string[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.storage
      .from('chat_uploads')
      .list(authUserId, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) {
      throw error;
    }

    const files = data ?? [];
    allPaths.push(
      ...files
        .filter((file) => file.name && file.name !== '.emptyFolderPlaceholder')
        .map((file) => `${authUserId}/${file.name}`),
    );

    if (files.length < limit) {
      break;
    }

    offset += files.length;
  }

  return allPaths;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.slice(7);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const uploadPaths = await listUserUploads(supabaseAdmin, user.id);
    if (uploadPaths.length > 0) {
      const { error: removeError } = await supabaseAdmin.storage
        .from('chat_uploads')
        .remove(uploadPaths);

      if (removeError) {
        throw removeError;
      }
    }

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      throw deleteUserError;
    }

    return new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('delete-account error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
