import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { readStoredAuthSession } from '../lib/authStorage';
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
  setProfileState: (profile: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null, user: null, profile: null,
  appUserId: null, loading: true, isAdmin: false,
  logout: async () => {},
  refreshProfile: async () => null,
  setProfileState: () => {},
});

/** Fields that should never be stored in client-side state (L5). */
const REDACTED_FIELDS = ['stripe_customer_id', 'stripe_subscription_id'] as const;

function readStoredSession(): Session | null {
  return readStoredAuthSession<Session>();
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

  // Track whether initial auth has resolved so onAuthStateChange never
  // touches the loading spinner after the first paint.
  const initDoneRef = useRef(false);

  // Stable ref to current user so memoized callbacks can read it without
  // being listed as deps (which would break memoization).
  const userRef = useRef<User | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const setProfileState = useCallback((nextProfile: UserProfile | null) => {
    setProfile(nextProfile);
    persistProfile(nextProfile);
  }, []);

  const fetchProfile = useCallback(async (
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
          setProfileState(sanitizedProfile);
          // Fire-and-forget admin check — non-blocking, fails silently
          supabase.rpc('is_admin').then(({ data: adminResult }) => {
            setIsAdmin(!!adminResult);
          }, () => { /* not an admin or RPC unavailable */ });
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
      setProfileState(null);
    }

    return null;
  }, [setProfileState]);

  const fetchProfileWithTimeout = useCallback(async (
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
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    setProfileState(null);
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    persistProfile(null);
    // Clear all cached query data so a subsequent login never sees the
    // previous user's fields, messages, or other cached responses.
    queryClient.clear();
    await supabase.auth.signOut();
  }, [setProfileState, queryClient]);

  useEffect(() => {
    let cancelled = false;
    let initialResolved = false;
    let restoredFromStorage = false;

    // Hydrate optimistically from localStorage so the UI doesn't flash a
    // loading spinner on every page load for already-authenticated users.
    // IMPORTANT: we do NOT set loading=false here — getSession() is still
    // in-flight and will be the source of truth. Setting loading=false early
    // caused ChatRouteGuard to briefly see authenticated=false (because
    // getSession hadn't resolved yet) and navigate the user back to "/".
    const hydrateFromStoredSession = () => {
      const storedSession = readStoredSession();
      if (!storedSession?.user) {
        return false;
      }

      const cachedProfile = readStoredProfile(storedSession.user.id);
      restoredFromStorage = true;
      // Populate state immediately so components have something to render,
      // but keep loading=true so guards wait for getSession() confirmation.
      setSession(storedSession);
      setUser(storedSession.user);
      if (cachedProfile) {
        setProfileState(cachedProfile);
      }
      // Kick off a profile refresh in the background; getSession() will call
      // its own fetchProfileWithTimeout so we use preserveExisting here to
      // avoid wiping the cached profile between the two calls.
      fetchProfileWithTimeout(storedSession.user.id, {
        retries: 4,
        delayMs: 250,
        preserveExisting: true,
      }).catch(() => {});
      return true;
    };

    hydrateFromStoredSession();

    // Step 1: getSession() processes the URL hash from magic links
    // and returns the authoritative current session. This is the single
    // point that flips loading → false for the initial render.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      initialResolved = true;
      initDoneRef.current = true;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfileWithTimeout(session.user.id, { preserveExisting: restoredFromStorage });
      } else if (!restoredFromStorage) {
        setProfileState(null);
      }
      if (!cancelled) setLoading(false);
    }).catch((err) => {
      console.error('getSession failed:', err);
      // Even on failure, unblock the UI — hydrateFromStoredSession already
      // populated state so the user won't see a broken screen.
      initialResolved = true;
      initDoneRef.current = true;
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
            initDoneRef.current = true;
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
          initDoneRef.current = true;
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
          setProfileState(null);
          resetAnalytics();
        }

        // Fix 2: only touch loading during init. Post-init events (TOKEN_REFRESHED,
        // USER_UPDATED, etc.) must NOT call setLoading — it triggers a re-render of
        // AppRoutes → new refreshProfile reference → Chat useEffect fires → fetchProfile
        // runs → another re-render → AbortController abort race kills the SSE POST.
        if (!initDoneRef.current) {
          if (!cancelled) setLoading(false);
        }
      }
    );

    // Safety net: if nothing resolves within 5s, stop the spinner.
    // This covers network failures where getSession() hangs indefinitely.
    const timeout = setTimeout(() => {
      if (!cancelled && !initialResolved) {
        const storedSession = readStoredSession();
        if (storedSession?.user) {
          console.warn('Auth init timed out — using persisted session fallback');
          initialResolved = true;
          initDoneRef.current = true;
          setSession(storedSession);
          setUser(storedSession.user);
          const cachedProfile = readStoredProfile(storedSession.user.id);
          if (cachedProfile) {
            setProfileState(cachedProfile);
          }
          fetchProfileWithTimeout(storedSession.user.id, {
            retries: 4,
            delayMs: 250,
            preserveExisting: true,
          }).finally(() => {
            if (!cancelled) setLoading(false);
          });
          // setLoading(false) will be called inside fetchProfileWithTimeout.finally
          return;
        }

        console.warn('Auth init timed out — forcing loading=false');
        initialResolved = true;
        initDoneRef.current = true;
        setLoading(false);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [fetchProfileWithTimeout, setProfileState]);

  // Fix 1: stable reference — only recreated if user changes (via userRef, not user directly).
  // Without useCallback, every AuthProvider render gave Chat a new refreshProfile reference,
  // which triggered Chat's useEffect([appUserId, refreshProfile]) → fetchProfile → re-render
  // → new reference → loop. This caused multiple fetchProfile calls and re-renders that
  // reset the AbortController mid-fetch, killing the SSE stream before the POST fired.
  const refreshProfile = useCallback(async (options?: RefreshProfileOptions) => {
    if (!userRef.current) {
      return null;
    }

    return await fetchProfile(userRef.current.id, {
      preserveExisting: true,
      ...options,
    });
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{
      session, user, profile, loading, isAdmin,
      appUserId: profile?.id ?? null,
      logout,
      refreshProfile,
      setProfileState,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
