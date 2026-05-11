/// <reference types="vite/client" />
import { createClient, type Session } from '@supabase/supabase-js';
import { readStoredAuthSession } from './authStorage';

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
  return readStoredAuthSession<Session>();
}

export async function getAccessTokenWithFallback(timeoutMs = 2500): Promise<string | null> {
  // Read the stored token defensively — the raw localStorage value may be in
  // either the standard { access_token } shape or the nested
  // { currentSession: { access_token } } shape Supabase writes after a refresh.
  const storedRaw = readStoredAuthSession<Record<string, unknown>>();
  const storedToken =
    (typeof storedRaw?.access_token === 'string' ? storedRaw.access_token : null) ??
    (typeof (storedRaw?.currentSession as Record<string, unknown> | undefined)?.access_token === 'string'
      ? (storedRaw!.currentSession as Record<string, unknown>).access_token as string
      : null);

  try {
    const sessionResult = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (sessionResult && 'data' in sessionResult) {
      return sessionResult.data.session?.access_token ?? storedToken ?? null;
    }
  } catch (error) {
    console.warn('Falling back to stored auth token:', error);
  }

  return storedToken ?? null;
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('id').eq('auth_id', user.id).single();
  return data?.id ?? null;
}
