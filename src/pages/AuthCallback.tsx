import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, readStoredSupabaseSession } from '../lib/supabase';
import { Leaf } from 'lucide-react';

/**
 * AuthCallback — handles both PKCE magic link AND OAuth (Google/Facebook) redirects.
 *
 * Magic link flow:  /auth/callback?code=xxxx  → exchangeCodeForSession
 * OAuth flow:       /auth/callback#access_token=xxxx  → already handled by
 *                   supabase client (detectSessionInUrl:true), onAuthStateChange fires
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const waitForSession = async (timeoutMs = 5000) => {
      const existing = readStoredSupabaseSession();
      if (existing) {
        return existing;
      }

      return await new Promise<Awaited<ReturnType<typeof readStoredSupabaseSession>>>((resolve) => {
        let settled = false;
        let timeoutId: number | undefined;

        const finish = (session: ReturnType<typeof readStoredSupabaseSession>) => {
          if (settled) return;
          settled = true;
          if (timeoutId) {
            window.clearTimeout(timeoutId);
          }
          subscription.unsubscribe();
          resolve(session);
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.access_token) {
            finish(session);
          }
        });

        supabase.auth.getSession()
          .then(({ data: { session } }) => {
            if (session?.access_token) {
              finish(session);
            }
          })
          .catch(() => {});

        timeoutId = window.setTimeout(() => finish(readStoredSupabaseSession()), timeoutMs);
      });
    };

    const handle = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const hasHashTokens = window.location.hash.includes('access_token');
      const hasError = url.searchParams.get('error') || window.location.hash.includes('error');

      // Handle error from OAuth provider
      if (hasError) {
        const errorDesc = url.searchParams.get('error_description') || 'Authentication failed';
        console.error('OAuth error:', errorDesc);
        setError(errorDesc);
        setTimeout(() => navigate('/auth', { replace: true }), 2500);
        return;
      }

      // Helper: resolve destination, preserving a typed question if present
      const chatDest = () => {
        const pending = sessionStorage.getItem('oli_pending_question');
        if (pending) {
          sessionStorage.removeItem('oli_pending_question');
          return `/chat?q=${encodeURIComponent(pending)}`;
        }
        return '/chat';
      };

      // OAuth flow: hash fragment (#access_token=...) — Supabase client
      // already processes this via detectSessionInUrl:true. onAuthStateChange
      // will fire with SIGNED_IN. Wait for a real session instead of a fixed timeout.
      if (hasHashTokens) {
        const session = await waitForSession();
        navigate(session ? chatDest() : '/auth', { replace: true });
        return;
      }

      // PKCE magic link / OAuth code flow: ?code= param — must exchange manually
      if (code) {
        // Capture event type before exchange (fires synchronously inside exchangeCodeForSession)
        let capturedEvent: string | null = null;
        const { data: { subscription: eventSub } } = supabase.auth.onAuthStateChange((event) => {
          capturedEvent = event;
        });

        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        eventSub.unsubscribe();
        // Scrub the one-time code from the URL bar and browser history so it
        // can't leak via Referer header to subsequent third-party requests.
        window.history.replaceState({}, '', '/auth/callback');
        if (error) {
          console.error('Auth callback error:', error.message);
          setError(error.message);
          setTimeout(() => navigate('/auth', { replace: true }), 2500);
          return;
        }
        const session = await waitForSession();
        if (!session) { navigate('/auth', { replace: true }); return; }
        navigate(capturedEvent === 'PASSWORD_RECOVERY' ? '/auth/update-password' : chatDest(), { replace: true });
        return;
      }

      // No code or hash — might be OAuth with implicit flow already processed
      // Check if we already have a session
      const session = await waitForSession(1500);
      if (session) {
        navigate(chatDest(), { replace: true });
      } else {
        navigate('/auth', { replace: true });
      }
    };

    handle();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="text-red-400 text-sm max-w-sm">
          {error.includes('expired') || error.includes('invalid')
            ? 'Link expired — please request a new one.'
            : 'Sign in failed. Redirecting...'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-background">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Leaf className="h-8 w-8 animate-pulse text-primary" />
      </div>
      <p className="text-sm text-muted">Σύνδεση...</p>
    </div>
  );
}
