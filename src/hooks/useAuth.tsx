import { createContext, useContext, useEffect, useRef, useCallback, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { identifyUser, resetAnalytics, trackEvent, Events } from '../lib/analytics';

/** L6: Inactivity timeout — auto-logout after 30 minutes of no user interaction. */
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown', 'keydown', 'touchstart', 'scroll', 'pointermove',
];

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
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null, user: null, profile: null,
  appUserId: null, loading: true,
  logout: async () => {},
  refreshProfile: async () => {},
});

/** Fields that should never be stored in client-side state (L5). */
const REDACTED_FIELDS = ['stripe_customer_id', 'stripe_subscription_id'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (authUserId: string): Promise<void> => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUserId)
        .maybeSingle();
      if (data) {
        // L5: Strip sensitive fields that the client never needs
        for (const field of REDACTED_FIELDS) delete (data as Record<string, unknown>)[field];
      }
      setProfile((data as UserProfile | null) ?? null);
    } catch (e) {
      console.error('fetchProfile error:', e);
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
    let cancelled = false;
    let initialResolved = false;

    // Step 1: getSession() processes the URL hash from magic links
    // and returns the current session (existing or just-authed).
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      initialResolved = true;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      if (!cancelled) setLoading(false);
    }).catch((err) => {
      console.error('getSession failed:', err);
      initialResolved = true;
      if (!cancelled) setLoading(false);
    });

    // Step 2: onAuthStateChange handles all future auth events.
    // Skip INITIAL_SESSION to avoid double-processing with getSession().
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;
        if (event === 'INITIAL_SESSION') {
          // If getSession() hasn't resolved yet, handle it here as fallback
          if (!initialResolved) {
            initialResolved = true;
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
              await fetchProfile(session.user.id);
            }
            if (!cancelled) setLoading(false);
          }
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
          if (event === 'SIGNED_IN') {
            identifyUser(session.user.id, { email: session.user.email });
            trackEvent(Events.LOGIN);
          }
        } else {
          setProfile(null);
          resetAnalytics();
        }
        setLoading(false);
      }
    );

    // Safety net: if nothing resolves within 5s, stop the spinner
    const timeout = setTimeout(() => {
      if (!cancelled && !initialResolved) {
        console.warn('Auth init timed out — forcing loading=false');
        initialResolved = true;
        setLoading(false);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // L6: Inactivity auto-logout — reset timer on any user interaction
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      logoutRef.current();
    }, INACTIVITY_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    // Only track inactivity when a user is logged in
    if (!session) {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      return;
    }

    resetInactivityTimer();

    const handler = () => resetInactivityTimer();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, handler, { passive: true });
    }

    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, handler);
      }
    };
  }, [session, resetInactivityTimer]);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{
      session, user, profile, loading,
      appUserId: profile?.id ?? null,
      logout,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
