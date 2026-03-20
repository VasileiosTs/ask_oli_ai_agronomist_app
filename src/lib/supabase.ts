/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabasePublicKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabaseAnonKey = supabasePublicKey;

export const supabase = createClient(supabaseUrl, supabasePublicKey);
