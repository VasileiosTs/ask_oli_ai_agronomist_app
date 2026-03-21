/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

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

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('users').select('id').eq('auth_id', user.id).single();
  return data?.id ?? null;
}
