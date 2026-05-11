import { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { useAuth } from './hooks/useAuth';
import { usePushSubscription } from './hooks/usePushSubscription';
import { useLanguage } from './lib/LanguageContext';
import AppLayout from './components/AppLayout';
import BottomNav from './components/BottomNav';
import LoadingSpinner from './components/LoadingSpinner';
import PaywallModal from './components/PaywallModal';
import LegalBackButton from './components/LegalBackButton';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import { Leaf, X } from 'lucide-react';

const Auth = lazy(() => import('./pages/Auth'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Landing = lazy(() => import('./pages/Landing'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Chat = lazy(() => import('./pages/Chat'));
const Profile = lazy(() => import('./pages/Profile'));
const History = lazy(() => import('./pages/History'));
const Fields = lazy(() => import('./pages/Fields'));
const SharedDiagnosis = lazy(() => import('./pages/SharedDiagnosis'));
const UpdatePassword = lazy(() => import('./pages/UpdatePassword'));
const AdminMetrics = lazy(() => import('./pages/AdminMetrics'));
const FieldDetail = lazy(() => import('./pages/FieldDetail'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const CooperativeAdmin = lazy(() => import('./pages/CooperativeAdmin'));

const NotFound = () => {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Leaf className="h-8 w-8 text-primary" />
      </div>
      <h1 className="mb-2 text-xl font-semibold text-foreground">{t.notFoundTitle}</h1>
      <p className="mb-6 text-sm text-muted">{t.notFoundBody}</p>
      <Link to="/" className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
        {t.notFoundHome}
      </Link>
    </div>
  );
};

const GUEST_CHAT_ENTRY_KEY = 'oli_guest_chat_entry';

function ChatRouteGuard({ authenticated, needsOnboarding }: { authenticated: boolean; needsOnboarding: boolean }) {
  const [searchParams] = useSearchParams();
  // Persist guest entry in sessionStorage so that Chat.tsx removing ?q= from
  // the URL doesn't cause an unauthenticated user to be bounced back to landing.
  const [guestEntry] = useState(() => {
    if (typeof window === 'undefined') return searchParams.has('q');
    const hasQuery = searchParams.has('q');
    const stored = sessionStorage.getItem(GUEST_CHAT_ENTRY_KEY) === '1';
    if (hasQuery) sessionStorage.setItem(GUEST_CHAT_ENTRY_KEY, '1');
    return hasQuery || stored;
  });

  if (authenticated) {
    return (
      <>
        <Chat />
        <BottomNav />
      </>
    );
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  if (guestEntry || searchParams.has('q')) {
    return <Chat />;
  }

  return <Navigate to="/" replace />;
}

function UpdateBanner() {
  const [show, setShow] = useState(false);
  const { lang } = useLanguage();

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('sw-update', handler);
    return () => window.removeEventListener('sw-update', handler);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between gap-3 bg-primary px-4 py-2.5 shadow-lg">
      <span className="text-sm font-medium text-white">
        {lang === 'el' ? 'Νέα έκδοση διαθέσιμη' : 'New version available'}
      </span>
      <button
        onClick={() => window.location.reload()}
        className="rounded-full bg-white/25 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/35"
      >
        {lang === 'el' ? 'Ενημέρωση' : 'Update'}
      </button>
    </div>
  );
}

function TrialExpiryBanner() {
  const { profile } = useAuth();
  const { lang } = useLanguage();
  const [showPaywall, setShowPaywall] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const tierExpiresAt = typeof profile?.tier_expires_at === 'string' ? profile.tier_expires_at : null;
  const tierSource = typeof profile?.tier_source === 'string' ? profile.tier_source : null;

  useEffect(() => {
    if (!profile?.id) return;
    const key = `oli-trial-banner-dismissed-${profile.id}`;
    const ts = localStorage.getItem(key);
    if (ts && Date.now() - Number(ts) < 24 * 60 * 60 * 1000) {
      setDismissed(true);
    } else {
      setDismissed(false);
    }
  }, [profile?.id]);

  if (!tierExpiresAt || !tierSource || !['trial', 'promo'].includes(tierSource)) return null;

  const expiresMs = new Date(tierExpiresAt).getTime();
  const daysLeft = Math.ceil((expiresMs - Date.now()) / 86400000);

  if (daysLeft > 5 || daysLeft <= 0 || dismissed) return null;

  const isEl = lang === 'el';
  const tier = typeof profile?.tier === 'string' ? profile.tier : 'pro';
  const tierLabel = tier === 'master' ? 'Master' : 'Pro';
  const isFinal = daysLeft <= 2;
  const daysStr = daysLeft === 1
    ? (isEl ? '1 μέρα' : '1 day')
    : (isEl ? `${daysLeft} μέρες` : `${daysLeft} days`);

  const dismiss = () => {
    if (!profile?.id) return;
    localStorage.setItem(`oli-trial-banner-dismissed-${profile.id}`, String(Date.now()));
    setDismissed(true);
  };

  return (
    <>
      <div
        className={[
          'fixed bottom-14 left-0 right-0 z-40 flex items-center justify-between gap-3 px-4 py-2.5 shadow-lg',
          isFinal
            ? 'bg-amber-500 text-white'
            : 'bg-primary/95 text-white',
        ].join(' ')}
      >
        <span className="text-sm font-medium leading-tight">
          {isFinal
            ? (isEl
                ? `⏳ Η δοκιμή σου λήγει σε ${daysStr}!`
                : `⏳ Trial ends in ${daysStr}!`)
            : (isEl
                ? `🌱 ${daysStr} ακόμα στο ${tierLabel} — αναβάθμισε`
                : `🌱 ${daysStr} left on ${tierLabel} — upgrade to keep it`)}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowPaywall(true)}
            className={[
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
              isFinal
                ? 'bg-white text-amber-700 hover:bg-amber-50'
                : 'bg-white/25 text-white hover:bg-white/35',
            ].join(' ')}
          >
            {isEl ? 'Αναβάθμιση' : 'Upgrade'}
          </button>
          <button
            onClick={dismiss}
            aria-label={isEl ? 'Κλείσιμο' : 'Dismiss'}
            className="rounded-full p-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
    </>
  );
}

function AppRoutes() {
  const { user, profile, loading, appUserId, isAdmin } = useAuth();
  const { lang } = useLanguage();
  const push = usePushSubscription(appUserId ?? null);

  // Auto-request push permission once the user is authenticated and hasn't been asked yet
  useEffect(() => {
    if (!user || !push.isSupported || push.isSubscribed || push.permission !== 'default') return;
    const t = setTimeout(() => { void push.subscribe(); }, 3000);
    return () => clearTimeout(t);
  }, [user, push.isSupported, push.isSubscribed, push.permission]);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  const authenticated = !!(user && profile && profile.onboarding_complete);
  const needsOnboarding = !!(user && (!profile || !profile.onboarding_complete));

  return (
    <Suspense fallback={<div className="flex h-[100dvh] items-center justify-center bg-background"><LoadingSpinner /></div>}>
      <UpdateBanner />
      <TrialExpiryBanner />
      <Routes>
        {/* Always public */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/update-password" element={<UpdatePassword />} />
        <Route path="/d/:shareId" element={<SharedDiagnosis />} />
        <Route path="/legal/privacy" element={<Privacy />} />
        <Route path="/legal/terms" element={<Terms />} />

        {/* Admin — requires authenticated admin_users membership */}
        <Route
          path="/admin/metrics"
          element={
            !user ? <Navigate to="/auth?next=/admin/metrics" replace />
            : isAdmin ? <AdminMetrics />
            : <Navigate to="/chat" replace />
          }
        />

        {/* Auth */}
        <Route
          path="/auth"
          element={
            authenticated ? <Navigate to="/chat" replace /> :
            needsOnboarding ? <Navigate to="/onboarding" replace /> :
            <Auth />
          }
        />

        {/* Onboarding */}
        <Route
          path="/onboarding"
          element={
            authenticated ? <Navigate to="/chat" replace /> :
            needsOnboarding ? <Onboarding /> :
            <Navigate to="/auth" replace />
          }
        />

        {/* Root — redirect authenticated users to chat, show landing for visitors */}
        <Route
          path="/"
          element={
            authenticated ? <Navigate to="/chat" replace /> :
            needsOnboarding ? <Navigate to="/onboarding" replace /> :
            <Landing />
          }
        />

        {/* Chat — accessible in guest mode (?q=) without auth */}
        <Route path="/chat" element={<ChatRouteGuard authenticated={authenticated} needsOnboarding={needsOnboarding} />} />

        {/* Protected routes */}
        <Route
          element={
            authenticated ? <AppLayout /> :
            needsOnboarding ? <Navigate to="/onboarding" replace /> :
            <Navigate to="/" replace />
          }
        >
          <Route path="/history" element={<History />} />
          <Route path="/fields" element={<Fields />} />
          <Route path="/fields/:fieldId" element={<FieldDetail />} />
          <Route path="/clients" element={<ClientDashboard />} />
          <Route path="/clients/:growerId" element={<ClientDetail />} />
          <Route path="/cooperative" element={<CooperativeAdmin />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

/** Wraps the full app (auth + routes) behind a lazy boundary.
 *  Imported lazily from App.tsx so Supabase is NOT in the critical path for the landing page. */
export default function AuthenticatedShell() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
