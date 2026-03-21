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
  isGuest: boolean;
  loginAsGuest: () => void;
  exitGuest: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null, user: null, profile: null, appUserId: null,
  loading: true, isGuest: false,
  loginAsGuest: () => {}, exitGuest: () => {}, logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('oli_guest') === 'true'
  );

  const loginAsGuest = () => {
    localStorage.setItem('oli_guest', 'true');
    setIsGuest(true);
  };

  // Exit guest without logging in — clears flag but stays on current page
  const exitGuest = () => {
    localStorage.removeItem('oli_guest');
    setIsGuest(false);
  };

  const logout = async () => {
    localStorage.removeItem('oli_guest');
    setIsGuest(false);
    setProfile(null);
    setUser(null);
    setSession(null);
    await supabase.auth.signOut();
  };

  const fetchProfile = async (authUserId: string) => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUserId)
        .maybeSingle();
      if (data) { setProfile(data as UserProfile); return; }

      // Legacy fallback
      const { data: legacy } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();
      setProfile((legacy as UserProfile | null) ?? null);
    } catch (e) {
      console.error('fetchProfile error:', e);
      setProfile(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => {
          if (!cancelled) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        // Clear guest if user just authenticated
        localStorage.removeItem('oli_guest');
        setIsGuest(false);
        fetchProfile(session.user.id).finally(() => {
          if (!cancelled) setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  return (
    <AuthContext.Provider value={{
      session, user, profile, loading, isGuest,
      appUserId: profile?.id ?? null,
      loginAsGuest, exitGuest, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
