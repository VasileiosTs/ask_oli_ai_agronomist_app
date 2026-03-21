import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Leaf } from 'lucide-react';

/**
 * AuthCallback — handles Supabase PKCE magic link redirect.
 *
 * Flow:
 *   1. User clicks magic link in email
 *   2. Supabase redirects to /auth/callback?code=xxxx
 *   3. This page exchanges the code for a session
 *   4. onAuthStateChange fires with SIGNED_IN
 *   5. useAuth sets user + profile → router sends to /chat or /onboarding
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const exchange = async () => {
      // exchangeCodeForSession reads the ?code= param from the current URL
      // and exchanges it with Supabase for a real session.
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        console.error('Auth callback error:', error.message);
        setError(error.message);
        // Wait 2s then send back to auth page
        setTimeout(() => navigate('/auth', { replace: true }), 2000);
        return;
      }

      // Session is now set. onAuthStateChange in useAuth will fire,
      // update the context, and App.tsx routing will redirect correctly.
      // We just need to go to root and let the router decide.
      navigate('/', { replace: true });
    };

    exchange();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="text-red-400 text-sm">
          Link expired or invalid. Redirecting to login...
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
