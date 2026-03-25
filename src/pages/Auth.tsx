import { useState, useEffect } from 'react';
import { Leaf, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import OliLogo from '../components/OliLogo';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { t, lang } = useLanguage();

  // SEO: noindex for auth page, set proper title
  useEffect(() => {
    document.title = lang === 'el' ? 'Σύνδεση — Oli' : 'Sign in — Oli';
    let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', 'noindex, nofollow');
    return () => { robotsMeta.setAttribute('content', 'index, follow'); };
  }, [lang]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleFacebook = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-4"
      style={{ background: '#faf9f4', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <div className="w-full max-w-[420px] rounded-[24px] bg-white p-8 md:p-10"
        style={{ boxShadow: '0 8px 40px rgba(25,65,33,0.08)', border: '1px solid rgba(194, 201, 187, 0.2)' }}>

        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4">
            <OliLogo size={48} bg="#faf9f4" />
          </div>
          <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "'Noto Serif', serif", color: '#194121' }}>Oli</h1>
          <p className="text-sm" style={{ color: '#606659' }}>{t.tagline}</p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center text-center animate-fade-in gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: '#c0eec0' }}>
              <CheckCircle2 className="h-7 w-7" style={{ color: '#194121' }} />
            </div>
            <div>
              <h2 className="mb-1 text-lg font-semibold" style={{ color: '#194121' }}>{t.checkEmailTitle}</h2>
              <p className="text-sm" style={{ color: '#606659' }}>
                {t.magicLinkSentTo}{' '}
                <strong style={{ color: '#1b1c19' }}>{email}</strong>
              </p>
            </div>
            <button
              onClick={() => { setSent(false); setError(''); }}
              className="flex items-center gap-1 text-sm transition-colors"
              style={{ color: '#606659' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#194121')}
              onMouseLeave={e => (e.currentTarget.style.color = '#606659')}
            >
              <ArrowLeft className="h-4 w-4" />
              {lang === 'el' ? 'Διαφορετικό email' : 'Use a different email'}
            </button>
          </div>
        ) : (
          <div className="space-y-5 animate-fade-in">

            {/* OAuth buttons */}
            <div className="space-y-3">
              <button onClick={handleGoogle}
                className="flex w-full items-center justify-center gap-3 rounded-full px-4 py-3.5 text-sm font-medium transition-all hover:shadow-md active:scale-[0.98]"
                style={{ background: '#fff', color: '#1b1c19', border: '1px solid #e3e3de' }}>
                <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {t.signInGoogle}
              </button>

              <button onClick={handleFacebook}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-[#1877F2] px-4 py-3.5 text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]">
                <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                {t.signInFacebook}
              </button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: '1px solid #e3e3de' }} />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="px-3 text-xs font-medium" style={{ background: '#fff', color: '#606659' }}>
                  {lang === 'el' ? 'ή' : 'or'}
                </span>
              </div>
            </div>

            {/* Magic link form */}
            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="w-full rounded-full px-5 py-3.5 text-sm focus:outline-none focus:ring-2"
                style={{
                  background: '#f5f4ef',
                  color: '#1b1c19',
                  border: '1px solid #e3e3de',
                  focusRingColor: '#194121',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#194121'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(25,65,33,0.15)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e3e3de'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              {error && (
                <p className="px-2 text-xs" style={{ color: '#ba1a1a' }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full rounded-full px-4 py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)', boxShadow: '0 4px 20px rgba(25,65,33,0.2)' }}
              >
                {loading ? '...' : t.magicLinkBtn}
              </button>
            </form>

          </div>
        )}

        {/* Footer links */}
        <div className="mt-8 flex justify-center gap-4 text-xs" style={{ color: '#606659' }}>
          <Link to="/legal/terms" className="transition-colors hover:underline" style={{ color: '#606659' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#194121')}
            onMouseLeave={e => (e.currentTarget.style.color = '#606659')}>
            {t.termsOfService}
          </Link>
          <span>·</span>
          <Link to="/legal/privacy" className="transition-colors hover:underline" style={{ color: '#606659' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#194121')}
            onMouseLeave={e => (e.currentTarget.style.color = '#606659')}>
            {t.privacyPolicy}
          </Link>
        </div>
      </div>
    </div>
  );
}
