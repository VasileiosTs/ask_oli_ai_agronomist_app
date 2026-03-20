import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppLayout from './components/AppLayout';
import { useAuth } from './hooks/useAuth';
import LoadingSpinner from './components/LoadingSpinner';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Chat from './pages/Chat';
import Fields from './pages/Fields';
import Profile from './pages/Profile';
import SharedDiagnosis from './pages/SharedDiagnosis';

const Privacy = () => (
  <div className="min-h-[100dvh] bg-background px-6 py-8 text-foreground">
    <h1 className="mb-4 text-2xl font-bold">Politiki Aporritoy</h1>
    <div className="space-y-4 text-sm text-muted leading-relaxed">
      <p><strong className="text-foreground">Dedomena pou sylegoume:</strong> onoma, topothe sia, dedomena kalliergion, minymata chat, fotografies.</p>
      <p><strong className="text-foreground">Xrisi:</strong> Paragwgi agronomikas symboulis kai veltiosi tis ypiresias.</p>
      <p><strong className="text-foreground">Apothikeusi:</strong> Supabase EU (Frankfurt) — GDPR compliant.</p>
      <p><strong className="text-foreground">Triti meri:</strong> Gemini (Google) gia AI epeksergasia — ta dedomena den apothikeyontai apo tin Google.</p>
      <p><strong className="text-foreground">Dikaioma eksaleipsis:</strong> Profile → Diagrafi logariasou gia na diagrafeis ola ta dedomena sou.</p>
      <p><strong className="text-foreground">Cookies:</strong> Kanena advertising cookie. Mono apothikeusi session.</p>
    </div>
  </div>
);

const Terms = () => (
  <div className="min-h-[100dvh] bg-background px-6 py-8 text-foreground">
    <h1 className="mb-4 text-2xl font-bold">Oroi Xrhshs</h1>
    <div className="space-y-4 text-sm text-muted leading-relaxed">
      <p>To Oli parechei AI symvoules gia enimerwsi monon. Den antikathistai o epistimonikas agronomikas symboylos.</p>
      <p>Panta symvoyleyesteite enan pistopoiimeno agronomo prin tin efarmogi ximilkon.</p>
      <p>To Oli den efthinetai gia apolyies sti sygkomidi poy prokyptoun apo ti chrisimi symvoylon AI.</p>
      <p>Oi chrisites prepei na einai ano ton 18 eton i na echoyn epotropeia.</p>
      <p>Apagoreyetai i katahrisi, ypesyla dedomenon, i antistroph michanologisi tis ypiresias.</p>
    </div>
  </div>
);

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

export default function App() {
  const { user, profile, loading, isGuest } = useAuth();

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/auth" element={(user && profile) || isGuest ? <Navigate to="/chat" replace /> : (user && !profile ? <Navigate to="/onboarding" replace /> : <Auth />)} />
        <Route path="/onboarding" element={user && profile ? <Navigate to="/chat" replace /> : (!user && !isGuest ? <Navigate to="/auth" replace /> : <Onboarding />)} />
        <Route path="/d/:shareId" element={<SharedDiagnosis />} />
        <Route path="/legal/privacy" element={<Privacy />} />
        <Route path="/legal/terms" element={<Terms />} />

        {/* Root Redirect */}
        <Route path="/" element={<Navigate to={(user && profile) || isGuest ? "/chat" : (user && !profile ? "/onboarding" : "/auth")} replace />} />

        {/* Protected Routes with Bottom Nav */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/chat" element={<Chat />} />
          <Route path="/fields" element={<Fields />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </QueryClientProvider>
  );
}
