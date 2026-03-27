/// <reference types="vite/client" />
import { createClient, type Session } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabasePublicKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabaseAnonKey = supabasePublicKey;

export const supabase = createClient(supabaseUrl, supabasePublicKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,   // processes magic link hash on page load
    autoRefreshToken: true,
    storageKey: 'oli-auth',
  },
});

export function readStoredSupabaseSession(): Session | null {
  try {
    const raw = localStorage.getItem('oli-auth');
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Session | null;
    if (!parsed?.access_token || !parsed?.user?.id) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function getAccessTokenWithFallback(timeoutMs = 2500): Promise<string | null> {
  const storedSession = readStoredSupabaseSession();

  try {
    const sessionResult = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (sessionResult && 'data' in sessionResult) {
      return sessionResult.data.session?.access_token ?? storedSession?.access_token ?? null;
    }
  } catch (error) {
    console.warn('Falling back to stored auth token:', error);
  }

  return storedSession?.access_token ?? null;
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('id').eq('auth_id', user.id).single();
  return data?.id ?? null;
}
