import { useState, useEffect } from 'react';
import { CheckCircle2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import OliLogo from '../components/OliLogo';

type AuthMode = 'signin' | 'signup' | 'magic' | 'forgot';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { t, lang } = useLanguage();
  const isEl = lang === 'el';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) localStorage.setItem('oli_referral', ref);
  }, []);

  useEffect(() => {
    document.title = isEl ? 'Σύνδεση — Oli' : 'Sign in — Oli';
    let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', 'noindex, nofollow');
    return () => { robotsMeta.setAttribute('content', 'index, follow'); };
  }, [lang]);

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(isEl ? 'Email ή κωδικός λάθος.' : 'Incorrect email or password.');
    setLoading(false);
  };

  const handlePasswordSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (password.length < 8) {
      setError(isEl ? 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.' : 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setSent(false);
    setPassword('');
  };

  const inputStyle = {
    background: '#f5f4ef',
    color: '#1b1c19',
    border: '1px solid #e3e3de',
  };
  const onFocusStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#194121';
    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(25,65,33,0.15)';
  };
  const onBlurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#e3e3de';
    e.currentTarget.style.boxShadow = 'none';
  };

  const sentMessages: Record<AuthMode, { title: string; body: string }> = {
    signup: {
      title: isEl ? 'Έλεγξε το email σου' : 'Check your email',
      body: isEl ? 'Έστειλα σύνδεσμο επιβεβαίωσης στο' : 'I sent a confirmation link to',
    },
    magic: {
      title: isEl ? 'Έλεγξε το email σου' : 'Check your email',
      body: isEl ? 'Έστειλα magic link στο' : 'I sent a magic link to',
    },
    forgot: {
      title: isEl ? 'Έλεγξε το email σου' : 'Check your email',
      body: isEl ? 'Έστειλα σύνδεσμο επαναφοράς κωδικού στο' : 'I sent a password reset link to',
    },
    signin: { title: '', body: '' },
  };

  if (sent) {
    const msg = sentMessages[mode];
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4"
        style={{ background: '#faf9f4', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <main className="w-full max-w-[420px] rounded-[24px] bg-white p-8 md:p-10"
          style={{ boxShadow: '0 8px 40px rgba(25,65,33,0.08)', border: '1px solid rgba(194, 201, 187, 0.2)' }}>
          <div className="flex flex-col items-center text-center animate-fade-in gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: '#c0eec0' }}>
              <CheckCircle2 className="h-7 w-7" style={{ color: '#194121' }} />
            </div>
            <div>
              <h2 className="mb-1 text-lg font-semibold" style={{ color: '#194121' }}>{msg.title}</h2>
              <p className="text-sm" style={{ color: '#606659' }}>
                {msg.body}{' '}
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
              {isEl ? 'Διαφορετικό email' : 'Use a different email'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-4"
      style={{ background: '#faf9f4', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <main className="w-full max-w-[420px] rounded-[24px] bg-white p-8 md:p-10"
        style={{ boxShadow: '0 8px 40px rgba(25,65,33,0.08)', border: '1px solid rgba(194, 201, 187, 0.2)' }}>

        {/* Back to home */}
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm transition-colors min-h-[44px]"
          style={{ color: '#606659' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#194121')}
          onMouseLeave={e => (e.currentTarget.style.color = '#606659')}>
          <ArrowLeft className="h-4 w-4" />
          {isEl ? 'Αρχική' : 'Home'}
        </Link>

        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4">
            <OliLogo size={48} bg="#faf9f4" />
          </div>
          <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "'Noto Serif', serif", color: '#194121' }}>Oli</h1>
          <p className="text-sm" style={{ color: '#606659' }}>{t.tagline}</p>
        </div>

        <div className="space-y-5 animate-fade-in">

          {/* Google */}
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

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: '1px solid #e3e3de' }} />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-xs font-medium uppercase" style={{ background: '#fff', color: '#606659' }}>
                {isEl ? 'ή' : 'or'}
              </span>
            </div>
          </div>

          {/* Sign in / Sign up — email + password */}
          {(mode === 'signin' || mode === 'signup') && (
            <>
              {/* Toggle */}
              <div className="flex rounded-full p-1" style={{ background: '#f5f4ef', border: '1px solid #e3e3de' }}>
                <button
                  onClick={() => switchMode('signin')}
                  className="flex-1 rounded-full py-2 text-sm font-medium transition-all"
                  style={mode === 'signin' ? { background: '#194121', color: '#fff' } : { color: '#606659' }}
                >
                  {isEl ? 'Σύνδεση' : 'Sign in'}
                </button>
                <button
                  onClick={() => switchMode('signup')}
                  className="flex-1 rounded-full py-2 text-sm font-medium transition-all"
                  style={mode === 'signup' ? { background: '#194121', color: '#fff' } : { color: '#606659' }}
                >
                  {isEl ? 'Εγγραφή' : 'Sign up'}
                </button>
              </div>

              <form onSubmit={mode === 'signin' ? handlePasswordSignIn : handlePasswordSignUp} className="space-y-3">
                <input
                  type="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  aria-label={t.emailPlaceholder}
                  className="w-full rounded-full px-5 py-3.5 text-sm focus:outline-none"
                  style={inputStyle}
                  onFocus={onFocusStyle}
                  onBlur={onBlurStyle}
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} required
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={isEl ? 'Κωδικός πρόσβασης' : 'Password'}
                    aria-label={isEl ? 'Κωδικός πρόσβασης' : 'Password'}
                    className="w-full rounded-full px-5 py-3.5 text-sm focus:outline-none pr-12"
                    style={inputStyle}
                    onFocus={onFocusStyle}
                    onBlur={onBlurStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
                    style={{ color: '#606659' }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {error && <p className="px-2 text-xs" style={{ color: '#ba1a1a' }}>{error}</p>}

                {mode === 'signin' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs transition-colors"
                      style={{ color: '#606659' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#194121')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#606659')}
                    >
                      {isEl ? 'Ξέχασα τον κωδικό' : 'Forgot password?'}
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim() || !password}
                  className="w-full rounded-full px-4 py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #194121 0%, #305936 100%)',
                    boxShadow: (email.trim() && password) ? '0 4px 20px rgba(25,65,33,0.2)' : 'none',
                  }}
                >
                  {loading ? '...' : mode === 'signin'
                    ? (isEl ? 'Σύνδεση' : 'Sign in')
                    : (isEl ? 'Δημιουργία λογαριασμού' : 'Create account')}
                </button>
              </form>

              {/* Magic link as third option */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchMode('magic')}
                  className="text-xs transition-colors"
                  style={{ color: '#909585' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#194121')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#909585')}
                >
                  {isEl ? 'Σύνδεση χωρίς κωδικό (magic link)' : 'Sign in without a password (magic link)'}
                </button>
              </div>
            </>
          )}

          {/* Forgot password */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <p className="text-sm" style={{ color: '#606659' }}>
                {isEl
                  ? 'Εισήγαγε το email σου και θα σου στείλω σύνδεσμο επαναφοράς κωδικού.'
                  : "Enter your email and I'll send you a password reset link."}
              </p>
              <input
                type="email" required autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="w-full rounded-full px-5 py-3.5 text-sm focus:outline-none"
                style={inputStyle}
                onFocus={onFocusStyle}
                onBlur={onBlurStyle}
              />
              {error && <p className="px-2 text-xs" style={{ color: '#ba1a1a' }}>{error}</p>}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full rounded-full px-4 py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)' }}
              >
                {loading ? '...' : isEl ? 'Αποστολή συνδέσμου' : 'Send reset link'}
              </button>
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="flex w-full items-center justify-center gap-1 text-sm transition-colors"
                style={{ color: '#606659' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#194121')}
                onMouseLeave={e => (e.currentTarget.style.color = '#606659')}
              >
                <ArrowLeft className="h-4 w-4" />
                {isEl ? 'Πίσω στη σύνδεση' : 'Back to sign in'}
              </button>
            </form>
          )}

          {/* Magic link */}
          {mode === 'magic' && (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <p className="text-sm" style={{ color: '#606659' }}>
                {isEl
                  ? 'Εισήγαγε το email σου και θα σου στείλω έναν σύνδεσμο σύνδεσης — χωρίς κωδικό.'
                  : "Enter your email and I'll send you a sign-in link — no password needed."}
              </p>
              <input
                type="email" required autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="w-full rounded-full px-5 py-3.5 text-sm focus:outline-none"
                style={inputStyle}
                onFocus={onFocusStyle}
                onBlur={onBlurStyle}
              />
              {error && <p className="px-2 text-xs" style={{ color: '#ba1a1a' }}>{error}</p>}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full rounded-full px-4 py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)' }}
              >
                {loading ? '...' : t.magicLinkBtn}
              </button>
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="flex w-full items-center justify-center gap-1 text-sm transition-colors"
                style={{ color: '#606659' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#194121')}
                onMouseLeave={e => (e.currentTarget.style.color = '#606659')}
              >
                <ArrowLeft className="h-4 w-4" />
                {isEl ? 'Πίσω στη σύνδεση' : 'Back to sign in'}
              </button>
            </form>
          )}

        </div>

        {/* Footer links */}
        <div className="mt-8 flex justify-center gap-4 text-xs" style={{ color: '#606659' }}>
          <Link to="/legal/terms"
            className="transition-colors hover:underline py-3 inline-flex items-center min-h-[44px]"
            style={{ color: '#606659' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#194121')}
            onMouseLeave={e => (e.currentTarget.style.color = '#606659')}>
            {t.termsOfService}
          </Link>
          <span className="flex items-center">·</span>
          <Link to="/legal/privacy"
            className="transition-colors hover:underline py-3 inline-flex items-center min-h-[44px]"
            style={{ color: '#606659' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#194121')}
            onMouseLeave={e => (e.currentTarget.style.color = '#606659')}>
            {t.privacyPolicy}
          </Link>
        </div>
      </main>
    </div>
  );
}
