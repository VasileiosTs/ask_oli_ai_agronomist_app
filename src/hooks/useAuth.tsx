import { useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  auth_id?: string | null;
  message_count_month?: number | null;
  onboarding_complete?: boolean | null;
  [key: string]: unknown;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(() => (
    typeof window !== 'undefined' && window.localStorage.getItem('oli_guest') === 'true'
  ));

  const loginAsGuest = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('oli_guest', 'true');
    }
    setIsGuest(true);
  };

  const logout = async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('oli_guest');
    }
    setIsGuest(false);
    await supabase.auth.signOut();
  };

  useEffect(() => {
    let isCancelled = false;

    const fetchProfile = async (authUserId: string) => {
      try {
        const { data: profileByAuthId } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', authUserId)
          .maybeSingle();

        if (profileByAuthId) {
          if (!isCancelled) {
            setProfile(profileByAuthId as UserProfile);
          }
          return;
        }

        const { data: legacyProfile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUserId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
        }

        if (!isCancelled) {
          setProfile((legacyProfile as UserProfile | null) ?? null);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        if (!isCancelled) {
          setProfile(null);
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isCancelled) {
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => {
          if (!isCancelled) {
            setLoading(false);
          }
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isCancelled) {
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        fetchProfile(session.user.id).finally(() => {
          if (!isCancelled) {
            setLoading(false);
          }
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const appUserId = profile?.id ?? null;

  return { session, user, profile, appUserId, loading, isGuest, loginAsGuest, logout };
}
