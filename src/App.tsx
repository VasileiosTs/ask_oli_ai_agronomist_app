import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider, useLanguage } from './lib/LanguageContext';
import AppLayout from './components/AppLayout';
import BottomNav from './components/BottomNav';
import { useAuth } from './hooks/useAuth';
import LoadingSpinner from './components/LoadingSpinner';
import { Leaf } from 'lucide-react';

const Auth = lazy(() => import('./pages/Auth'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Landing = lazy(() => import('./pages/Landing'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Chat = lazy(() => import('./pages/Chat'));
const Profile = lazy(() => import('./pages/Profile'));
const History = lazy(() => import('./pages/History'));
const Fields = lazy(() => import('./pages/Fields'));
const SharedDiagnosis = lazy(() => import('./pages/SharedDiagnosis'));
const AdminMetrics = lazy(() => import('./pages/AdminMetrics'));

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

const Privacy = () => {
  const { t } = useLanguage();
  const h2 = "text-base font-semibold text-foreground mt-4";
  return (
    <div className="min-h-[100dvh] bg-background px-6 py-8 text-foreground max-w-2xl mx-auto">
      <h1 className="mb-6 text-2xl font-bold">{t.privacyPolicy}</h1>
      <div className="space-y-4 text-sm text-muted leading-relaxed">
        <p className="text-xs text-muted">{t.legalUpdated}</p>
        <h2 className={h2}>1. {t.privacyDataTitle}</h2>
        <p>{t.privacyDataAccount}</p><p>{t.privacyDataUsage}</p><p>{t.privacyDataTech}</p>
        <h2 className={h2}>2. {t.privacyHowTitle}</h2>
        <p>{t.privacyHowBody}</p>
        <h2 className={h2}>3. {t.privacyStorageTitle}</h2>
        <p>{t.privacyStorageBody}</p><p><strong className="text-foreground">Row Level Security:</strong> {t.privacyStorageRls}</p>
        <h2 className={h2}>4. {t.privacyThirdTitle}</h2>
        <p><strong className="text-foreground">Google Gemini:</strong> {t.privacyGemini}</p>
        <p><strong className="text-foreground">Sentry:</strong> {t.privacySentry}</p>
        <p><strong className="text-foreground">Vercel:</strong> {t.privacyVercel}</p>
        <h2 className={h2}>5. {t.privacyGdprTitle}</h2>
        <p>{t.privacyGdprAccess}</p><p>{t.privacyGdprDelete}</p><p>{t.privacyGdprCorrect}</p><p>{t.privacyGdprPortability}</p>
        <h2 className={h2}>6. Cookies</h2>
        <p>{t.privacyCookies}</p>
        <h2 className={h2}>7. {t.privacyAge}</h2>
        <h2 className={h2}>8. {t.privacyContact}</h2>
      </div>
    </div>
  );
};

const Terms = () => {
  const { t } = useLanguage();
  const h2 = "text-base font-semibold text-foreground mt-4";
  return (
    <div className="min-h-[100dvh] bg-background px-6 py-8 text-foreground max-w-2xl mx-auto">
      <h1 className="mb-6 text-2xl font-bold">{t.termsOfService}</h1>
      <div className="space-y-4 text-sm text-muted leading-relaxed">
        <p className="text-xs text-muted">{t.legalUpdated}</p>
        <h2 className={h2}>1. {t.termsNature}</h2><p>{t.termsNatureBody}</p>
        <h2 className={h2}>2. {t.termsLiability}</h2><p>{t.termsLiabilityBody}</p>
        <h2 className={h2}>3. {t.termsUse}</h2><p>{t.termsUseBody}</p>
        <h2 className={h2}>4. {t.termsAccounts}</h2><p>{t.termsAccountsBody}</p>
        <h2 className={h2}>5. {t.termsIp}</h2><p>{t.termsIpBody}</p>
        <h2 className={h2}>6. {t.termsTermination}</h2><p>{t.termsTerminationBody}</p>
        <h2 className={h2}>7. {t.termsLaw}</h2><p>{t.termsLawBody}</p>
      </div>
    </div>
  );
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } },
});

/** Allows /chat in guest mode when ?q= is present; otherwise enforces auth */
function ChatRouteGuard({ authenticated, needsOnboarding }: { authenticated: boolean; needsOnboarding: boolean }) {
  const [searchParams] = useSearchParams();
  // Remember guest entry so Chat clearing ?q= doesn't unmount us
  const [guestEntry] = useState(() => searchParams.has('q'));

  if (authenticated) {
    return (
      <div className="flex h-[100dvh] w-full flex-col bg-background text-foreground">
        <Chat />
        <BottomNav />
      </div>
    );
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Guest mode: allow if ?q= param was present on mount (no bottom nav)
  if (guestEntry || searchParams.has('q')) {
    return <Chat />;
  }

  return <Navigate to="/" replace />;
}

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  // Show spinner while auth state is being determined
  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  const authenticated = !!(user && profile && profile.onboarding_complete); // signed in + profile complete
  const needsOnboarding = !!(user && (!profile || !profile.onboarding_complete)); // signed in but onboarding incomplete

  return (
    <Suspense fallback={<div className="flex h-[100dvh] items-center justify-center bg-background"><LoadingSpinner /></div>}>
    <Routes>
      {/* Always public */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/d/:shareId" element={<SharedDiagnosis />} />
      <Route path="/legal/privacy" element={<Privacy />} />
      <Route path="/legal/terms" element={<Terms />} />

      {/* Admin */}
      <Route path="/admin/metrics" element={<AdminMetrics />} />

      {/* Auth — only for unauthenticated users */}
      <Route
        path="/auth"
        element={
          authenticated ? <Navigate to="/chat" replace /> :
          needsOnboarding ? <Navigate to="/onboarding" replace /> :
          <Auth />
        }
      />

      {/* Onboarding — only for users who need to complete their profile */}
      <Route
        path="/onboarding"
        element={
          authenticated ? <Navigate to="/chat" replace /> :
          needsOnboarding ? <Onboarding /> :
          <Navigate to="/auth" replace />
        }
      />

      {/* Root — landing page for visitors, smart redirect for authenticated */}
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

      {/* Protected routes — require completed profile */}
      <Route
        element={
          authenticated ? <AppLayout /> :
          needsOnboarding ? <Navigate to="/onboarding" replace /> :
          <Navigate to="/" replace />
        }
      >
        <Route path="/history" element={<History />} />
        <Route path="/fields" element={<Fields />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
