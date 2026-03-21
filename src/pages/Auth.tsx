import { useState } from 'react';
import { Leaf, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { t, lang } = useLanguage();

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const handleFacebook = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
      <div className="w-full max-w-[420px] rounded-[16px] bg-surface p-8 shadow-xl border border-border">

        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Leaf className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Oli</h1>
          <p className="text-sm text-muted">{t.tagline}</p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center text-center animate-fade-in gap-4">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <div>
              <h2 className="mb-1 text-lg font-semibold text-foreground">{t.checkEmailTitle}</h2>
              <p className="text-sm text-muted">
                {t.magicLinkSentTo}{' '}
                <strong className="text-foreground">{email}</strong>
              </p>
            </div>
            <button
              onClick={() => { setSent(false); setError(''); }}
              className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {lang === 'el' ? 'Διαφορετικό email' : 'Use a different email'}
            </button>
          </div>
        ) : (
          <div className="space-y-5 animate-fade-in">

            <div className="space-y-3">
              <button onClick={handleGoogle}
                className="flex w-full items-center justify-center gap-3 rounded-[22px] bg-white px-4 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90 active:scale-[0.98]">
                <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {t.signInGoogle}
              </button>

              <button onClick={handleFacebook}
                className="flex w-full items-center justify-center gap-3 rounded-[22px] bg-[#1877F2] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 active:scale-[0.98]">
                <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                {t.signInFacebook}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-muted">
                  {lang === 'el' ? 'ή' : 'or'}
                </span>
              </div>
            </div>

            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="w-full rounded-[22px] border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {error && (
                <p className="px-1 text-xs text-red-400">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full rounded-[22px] bg-primary px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? '...' : t.magicLinkBtn}
              </button>
            </form>

          </div>
        )}

        <div className="mt-8 flex justify-center gap-4 text-xs text-muted">
          <Link to="/legal/terms" className="hover:text-foreground">{t.termsOfService}</Link>
          <span>·</span>
          <Link to="/legal/privacy" className="hover:text-foreground">{t.privacyPolicy}</Link>
        </div>
      </div>
    </div>
  );
}
