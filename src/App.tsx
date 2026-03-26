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
import History from './pages/History';
import Fields from './pages/Fields';
import SharedDiagnosis from './pages/SharedDiagnosis';

const Privacy = () => {
  const { t } = useLanguage();
  return (
    <div className="min-h-[100dvh] bg-background px-6 py-8 text-foreground max-w-2xl mx-auto">
      <h1 className="mb-6 text-2xl font-bold">{t.privacyPolicy}</h1>
      <div className="space-y-4 text-sm text-muted leading-relaxed">
        <p className="text-xs text-muted">Τελευταία ενημέρωση: Μάρτιος 2026</p>

        <h2 className="text-base font-semibold text-foreground mt-4">1. Δεδομένα που συλλέγουμε</h2>
        <p><strong className="text-foreground">Στοιχεία λογαριασμού:</strong> email, όνομα, τοποθεσία, κύρια καλλιέργεια.</p>
        <p><strong className="text-foreground">Δεδομένα χρήσης:</strong> μηνύματα chat, φωτογραφίες, δεδομένα αγροτεμαχίων, καταγεγραμμένες παρεμβάσεις, αποτελέσματα VIO.</p>
        <p><strong className="text-foreground">Τεχνικά δεδομένα:</strong> διεύθυνση IP (μόνο για ασφάλεια), user agent, γλώσσα προτίμησης.</p>

        <h2 className="text-base font-semibold text-foreground mt-4">2. Πώς χρησιμοποιούμε τα δεδομένα</h2>
        <p>Παροχή εξατομικευμένης αγρονομικής συμβουλής, βελτίωση της υπηρεσίας, αποστολή follow-up ειδοποιήσεων για τον κύκλο VIO.</p>

        <h2 className="text-base font-semibold text-foreground mt-4">3. Αποθήκευση &amp; Ασφάλεια</h2>
        <p><strong className="text-foreground">Αποθήκευση:</strong> Supabase EU (Frankfurt) — GDPR compliant. Κρυπτογράφηση at rest και in transit.</p>
        <p><strong className="text-foreground">Row Level Security:</strong> Κάθε χρήστης βλέπει μόνο τα δικά του δεδομένα.</p>

        <h2 className="text-base font-semibold text-foreground mt-4">4. Τρίτα μέρη</h2>
        <p><strong className="text-foreground">Google Gemini:</strong> Τα μηνύματα αποστέλλονται στο Gemini API για AI επεξεργασία. Η Google δεν αποθηκεύει τα δεδομένα πέραν της επεξεργασίας.</p>
        <p><strong className="text-foreground">Sentry:</strong> Αναφορές σφαλμάτων (χωρίς προσωπικά δεδομένα).</p>
        <p><strong className="text-foreground">Vercel:</strong> Hosting — EU edge nodes.</p>

        <h2 className="text-base font-semibold text-foreground mt-4">5. Δικαιώματά σας (GDPR)</h2>
        <p><strong className="text-foreground">Πρόσβαση:</strong> Profile → Εξαγωγή δεδομένων (JSON).</p>
        <p><strong className="text-foreground">Διαγραφή:</strong> Profile → Διαγραφή λογαριασμού — διαγράφονται ΟΛΑ τα δεδομένα (μηνύματα, φωτογραφίες, αγροτεμάχια, παρεμβάσεις).</p>
        <p><strong className="text-foreground">Διόρθωση:</strong> Profile → Επεξεργασία προφίλ.</p>
        <p><strong className="text-foreground">Φορητότητα:</strong> Τα δεδομένα εξάγονται σε JSON format.</p>

        <h2 className="text-base font-semibold text-foreground mt-4">6. Cookies</h2>
        <p>Κανένα advertising cookie. Μόνο essential session cookies για authentication.</p>

        <h2 className="text-base font-semibold text-foreground mt-4">7. Ηλικιακός περιορισμός</h2>
        <p>Η υπηρεσία προορίζεται για χρήστες άνω των 18 ετών.</p>

        <h2 className="text-base font-semibold text-foreground mt-4">8. Επικοινωνία</h2>
        <p>Για θέματα προστασίας δεδομένων: privacy@askoli.ai</p>
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
        <p className="text-xs text-muted">Τελευταία ενημέρωση: Μάρτιος 2026</p>

        <h2 className="text-base font-semibold text-foreground mt-4">1. Φύση της υπηρεσίας</h2>
        <p>Το Oli παρέχει AI συμβουλές για ενημέρωση μόνο. Δεν αντικαθιστά τον επιστημονικό αγρονομικό σύμβουλο. Πάντα συμβουλευτείτε έναν πιστοποιημένο αγρονόμο πριν την εφαρμογή χημικών σκευασμάτων.</p>

        <h2 className="text-base font-semibold text-foreground mt-4">2. Περιορισμός ευθύνης</h2>
        <p>Το Oli δεν ευθύνεται για απώλειες στη σοδειά, ζημιές από λανθασμένη εφαρμογή συμβουλών, ή οποιαδήποτε έμμεση ζημία. Η χρήση γίνεται με αποκλειστική ευθύνη του χρήστη.</p>

        <h2 className="text-base font-semibold text-foreground mt-4">3. Αποδεκτή χρήση</h2>
        <p>Απαγορεύεται: η κατάχρηση ή αντίστροφη μηχανολόγηση, η αποστολή spam ή κακόβουλου περιεχομένου, η απόπειρα εξαγωγής του AI μοντέλου, η χρήση για παράνομους σκοπούς.</p>

        <h2 className="text-base font-semibold text-foreground mt-4">4. Λογαριασμοί</h2>
        <p>Οι χρήστες πρέπει να είναι άνω των 18 ετών. Κάθε χρήστης δικαιούται έναν λογαριασμό. Η δωρεάν βαθμίδα περιλαμβάνει 20 μηνύματα/μήνα.</p>

        <h2 className="text-base font-semibold text-foreground mt-4">5. Πνευματική ιδιοκτησία</h2>
        <p>Το περιεχόμενο που δημιουργείτε (μηνύματα, φωτογραφίες) παραμένει δικό σας. Μας παρέχετε άδεια επεξεργασίας για τη λειτουργία της υπηρεσίας.</p>

        <h2 className="text-base font-semibold text-foreground mt-4">6. Τερματισμός</h2>
        <p>Διατηρούμε το δικαίωμα αναστολής λογαριασμών που παραβιάζουν τους όρους. Μπορείτε να διαγράψετε τον λογαριασμό σας ανά πάσα στιγμή από το Profile.</p>

        <h2 className="text-base font-semibold text-foreground mt-4">7. Εφαρμοστέο δίκαιο</h2>
        <p>Εφαρμόζεται το ελληνικό δίκαιο. Αρμόδια δικαστήρια τα δικαστήρια Αθηνών.</p>
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
          <Navigate to="/" replace />
        }
      >
        <Route path="/chat" element={<Chat />} />
        <Route path="/history" element={<History />} />
        <Route path="/fields" element={<Fields />} />
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
