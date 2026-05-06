import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { identifyUser, resetAnalytics, trackEvent, Events } from '../lib/analytics';

const PROFILE_FETCH_TIMEOUT_MS = 4000;
const PROFILE_STORAGE_KEY = 'oli-profile-cache';
export interface UserProfile {
  id: string;
  auth_id?: string | null;
  message_count_month?: number | null;
  message_reset_date?: string | null;
  onboarding_complete?: boolean | null;
  [key: string]: unknown;
}

interface RefreshProfileOptions {
  retries?: number;
  delayMs?: number;
  requireCompletedOnboarding?: boolean;
  preserveExisting?: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  appUserId: string | null;
  loading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
  refreshProfile: (options?: RefreshProfileOptions) => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null, user: null, profile: null,
  appUserId: null, loading: true, isAdmin: false,
  logout: async () => {},
  refreshProfile: async () => null,
});

/** Fields that should never be stored in client-side state (L5). */
const REDACTED_FIELDS = ['stripe_customer_id', 'stripe_subscription_id'] as const;

function readStoredSession(): Session | null {
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
  } catch (error) {
    console.warn('Failed to read stored session fallback:', error);
    return null;
  }
}

function readStoredProfile(authUserId?: string | null): UserProfile | null {
  if (!authUserId) {
    return null;
  }

  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as UserProfile | null;
    if (!parsed || parsed.auth_id !== authUserId) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to read stored profile fallback:', error);
    return null;
  }
}

function persistProfile(profile: UserProfile | null) {
  try {
    if (!profile) {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
      return;
    }

    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn('Failed to persist profile cache:', error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchProfile = async (
    authUserId: string,
    options: RefreshProfileOptions = {},
  ): Promise<UserProfile | null> => {
    const {
      retries = 0,
      delayMs = 250,
      requireCompletedOnboarding = false,
      preserveExisting = false,
    } = options;

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', authUserId)
          .maybeSingle();

        if (error) {
          lastError = error;
        } else if (data && (!requireCompletedOnboarding || !!data.onboarding_complete)) {
          for (const field of REDACTED_FIELDS) {
            delete (data as Record<string, unknown>)[field];
          }
          const sanitizedProfile = data as UserProfile;
          setProfile(sanitizedProfile);
          persistProfile(sanitizedProfile);
          // Fire-and-forget admin check — non-blocking, fails silently
          supabase.rpc('is_admin').then(({ data: adminResult }) => {
            setIsAdmin(!!adminResult);
          }).catch(() => { /* not an admin or RPC unavailable */ });
          return sanitizedProfile;
        }
      } catch (error) {
        lastError = error;
      }

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (lastError) {
      console.error('fetchProfile error:', lastError);
    }

    if (!preserveExisting) {
      setProfile(null);
      persistProfile(null);
    }

    return null;
  };

  const fetchProfileWithTimeout = async (
    authUserId: string,
    options: RefreshProfileOptions = {},
  ) => {
    const cachedProfile = readStoredProfile(authUserId);

    return await Promise.race([
      fetchProfile(authUserId, options),
      new Promise<UserProfile | null>((resolve) => {
        window.setTimeout(() => resolve(cachedProfile), PROFILE_FETCH_TIMEOUT_MS);
      }),
    ]);
  };

  const logout = async () => {
    setProfile(null);
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    persistProfile(null);
    // Clear all cached query data so a subsequent login never sees the
    // previous user's fields, messages, or other cached responses.
    queryClient.clear();
    await supabase.auth.signOut();
  };

  useEffect(() => {
    let cancelled = false;
    let initialResolved = false;
    let restoredFromStorage = false;

    const hydrateFromStoredSession = () => {
      const storedSession = readStoredSession();
      if (!storedSession?.user) {
        return false;
      }

      const cachedProfile = readStoredProfile(storedSession.user.id);
      restoredFromStorage = true;
      initialResolved = true;
      setSession(storedSession);
      setUser(storedSession.user);
      if (cachedProfile) {
        setProfile(cachedProfile);
        setLoading(false);
      }
      fetchProfileWithTimeout(storedSession.user.id, {
        retries: 4,
        delayMs: 250,
        preserveExisting: true,
      }).finally(() => {
        if (!cancelled) setLoading(false);
      });
      return true;
    };

    hydrateFromStoredSession();

    // Step 1: getSession() processes the URL hash from magic links
    // and returns the current session (existing or just-authed).
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      initialResolved = true;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfileWithTimeout(session.user.id, { preserveExisting: restoredFromStorage });
      } else if (!restoredFromStorage) {
        setProfile(null);
        persistProfile(null);
      }
      if (!cancelled) setLoading(false);
    }).catch((err) => {
      console.error('getSession failed:', err);
      if (!restoredFromStorage) {
        initialResolved = true;
        if (!cancelled) setLoading(false);
      }
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
              // preserveExisting: keep cached profile visible while DB fetch is in-flight
              // so authenticated state never briefly flips false on load
              await fetchProfileWithTimeout(session.user.id, { preserveExisting: true });
            }
            if (!cancelled) setLoading(false);
          }
          return;
        }

        if (!initialResolved) {
          initialResolved = true;
        }

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // For TOKEN_REFRESHED and all non-SIGNED_OUT events: preserve the existing profile
          // while the DB fetch is in-flight so authenticated never briefly flips false,
          // which would cause ChatRouteGuard to navigate the user away from /chat.
          // The profile gets updated in-place when fetchProfile resolves successfully.
          // Only SIGNED_IN clears stale profile (previous user's data already wiped on SIGNED_OUT).
          await fetchProfileWithTimeout(session.user.id, { preserveExisting: true });
          if (event === 'SIGNED_IN') {
            // Identify by user ID only — no email (GDPR: email is PII)
            identifyUser(session.user.id);
            trackEvent(Events.LOGIN);
          }
        } else {
          setProfile(null);
          persistProfile(null);
          resetAnalytics();
        }
        setLoading(false);
      }
    );

    // Safety net: if nothing resolves within 5s, stop the spinner
    const timeout = setTimeout(() => {
      if (!cancelled && !initialResolved) {
        const storedSession = readStoredSession();
        if (storedSession?.user) {
          console.warn('Auth init timed out — using persisted session fallback');
          initialResolved = true;
          setSession(storedSession);
          setUser(storedSession.user);
          const cachedProfile = readStoredProfile(storedSession.user.id);
          if (cachedProfile) {
            setProfile(cachedProfile);
            setLoading(false);
          }
          fetchProfileWithTimeout(storedSession.user.id, {
            retries: 4,
            delayMs: 250,
            preserveExisting: true,
          }).finally(() => {
            if (!cancelled) setLoading(false);
          });
          return;
        }

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

  const refreshProfile = async (options?: RefreshProfileOptions) => {
    if (!user) {
      return null;
    }

    return await fetchProfile(user.id, {
      preserveExisting: true,
      ...options,
    });
  };

  return (
    <AuthContext.Provider value={{
      session, user, profile, loading, isAdmin,
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
