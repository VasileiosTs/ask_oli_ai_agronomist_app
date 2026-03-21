import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  auth_id?: string | null;
  message_count_month?: number | null;
  onboarding_complete?: boolean | null;
  [key: string]: unknown;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  appUserId: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null, user: null, profile: null,
  appUserId: null, loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (authUserId: string): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUserId)
        .maybeSingle();
      if (error) console.error('fetchProfile error:', error.message);
      setProfile((data as UserProfile | null) ?? null);
    } catch (e) {
      console.error('fetchProfile exception:', e);
      setProfile(null);
    }
  };

  const logout = async () => {
    setProfile(null);
    setUser(null);
    setSession(null);
    await supabase.auth.signOut();
  };

  useEffect(() => {
    // onAuthStateChange is the SINGLE source of truth.
    // It fires on page load (with existing session or null),
    // AND when a magic link hash is processed (SIGNED_IN).
    // We do NOT call getSession() separately to avoid race conditions.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{
      session, user, profile, loading,
      appUserId: profile?.id ?? null,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
