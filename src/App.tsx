import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider, useLanguage } from './lib/LanguageContext';
import AppLayout from './components/AppLayout';
import { useAuth } from './hooks/useAuth';
import LoadingSpinner from './components/LoadingSpinner';
import Auth from './pages/Auth';
import AuthCallback from './pages/AuthCallback';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import SharedDiagnosis from './pages/SharedDiagnosis';

const Privacy = () => {
  const { t } = useLanguage();
  return (
    <div className="min-h-[100dvh] bg-background px-6 py-8 text-foreground max-w-2xl mx-auto">
      <h1 className="mb-6 text-2xl font-bold">{t.privacyPolicy}</h1>
      <div className="space-y-4 text-sm text-muted leading-relaxed">
        <p><strong className="text-foreground">Δεδομένα που συλλέγουμε:</strong> όνομα, τοποθεσία, δεδομένα καλλιεργιών, μηνύματα chat, φωτογραφίες.</p>
        <p><strong className="text-foreground">Χρήση:</strong> Παροχή αγρονομικής συμβουλής και βελτίωση της υπηρεσίας.</p>
        <p><strong className="text-foreground">Αποθήκευση:</strong> Supabase EU (Frankfurt) — GDPR compliant.</p>
        <p><strong className="text-foreground">Τρίτα μέρη:</strong> Gemini (Google) για AI επεξεργασία.</p>
        <p><strong className="text-foreground">Δικαίωμα εξάλειψης:</strong> Profile → Διαγραφή λογαριασμού.</p>
        <p><strong className="text-foreground">Cookies:</strong> Κανένα advertising cookie.</p>
      </div>
    </div>
  );
};

const Terms = () => {
  const { t } = useLanguage();
  return (
    <div className="min-h-[100dvh] bg-background px-6 py-8 text-foreground max-w-2xl mx-auto">
      <h1 className="mb-6 text-2xl font-bold">{t.termsOfService}</h1>
      <div className="space-y-4 text-sm text-muted leading-relaxed">
        <p>Το Oli παρέχει AI συμβουλές για ενημέρωση μόνο. Δεν αντικαθιστά τον επιστημονικό αγρονομικό σύμβουλο.</p>
        <p>Πάντα συμβουλευτείτε έναν πιστοποιημένο αγρονόμο πριν την εφαρμογή χημικών.</p>
        <p>Το Oli δεν ευθύνεται για απώλειες στη σοδειά.</p>
        <p>Οι χρήστες πρέπει να είναι άνω των 18 ετών.</p>
        <p>Απαγορεύεται η κατάχρηση ή αντίστροφη μηχανολόγηση.</p>
      </div>
    </div>
  );
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } },
});

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
    <Routes>
      {/* Always public */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/d/:shareId" element={<SharedDiagnosis />} />
      <Route path="/legal/privacy" element={<Privacy />} />
      <Route path="/legal/terms" element={<Terms />} />

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

      {/* Protected routes — require completed profile */}
      <Route
        element={
          authenticated ? <AppLayout /> :
          needsOnboarding ? <Navigate to="/onboarding" replace /> :
          <Navigate to="/auth" replace />
        }
      >
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
