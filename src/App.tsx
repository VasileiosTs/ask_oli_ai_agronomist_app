import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider, useLanguage } from './lib/LanguageContext';
import AppLayout from './components/AppLayout';
import { useAuth } from './hooks/useAuth';
import LoadingSpinner from './components/LoadingSpinner';
import Auth from './pages/Auth';
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
        <p><strong className="text-foreground">Τρίτα μέρη:</strong> Gemini (Google) για AI επεξεργασία — τα δεδομένα δεν αποθηκεύονται από την Google.</p>
        <p><strong className="text-foreground">Δικαίωμα εξάλειψης:</strong> Profile → Διαγραφή λογαριασμού για να διαγράψεις όλα τα δεδομένα σου.</p>
        <p><strong className="text-foreground">Cookies:</strong> Κανένα advertising cookie. Μόνο αποθήκευση session.</p>
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
        <p>Το Oli δεν ευθύνεται για απώλειες στη σοδειά που προκύπτουν από τη χρήση AI συμβουλών.</p>
        <p>Οι χρήστες πρέπει να είναι άνω των 18 ετών ή να έχουν επιτροπεία.</p>
        <p>Απαγορεύεται η κατάχρηση, υπεξαίρεση δεδομένων, ή αντίστροφη μηχανολόγηση της υπηρεσίας.</p>
      </div>
    </div>
  );
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, isGuest } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user && !isGuest) return <Navigate to="/auth" replace />;
  if (user && !profile && !isGuest) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, profile, loading, isGuest } = useAuth();

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  const authed = (user && profile) || isGuest;

  return (
    <Routes>
      <Route path="/auth" element={authed ? <Navigate to="/chat" replace /> : <Auth />} />
      <Route path="/onboarding" element={user && profile ? <Navigate to="/chat" replace /> : (!user && !isGuest ? <Navigate to="/auth" replace /> : <Onboarding />)} />
      <Route path="/d/:shareId" element={<SharedDiagnosis />} />
      <Route path="/legal/privacy" element={<Privacy />} />
      <Route path="/legal/terms" element={<Terms />} />
      <Route path="/" element={<Navigate to={authed ? "/chat" : "/auth"} replace />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
        {/* /fields hidden from nav but kept for data layer */}
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
