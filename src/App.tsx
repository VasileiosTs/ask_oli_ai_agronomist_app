import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import { useAuth } from './hooks/useAuth';
import LoadingSpinner from './components/LoadingSpinner';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Chat from './pages/Chat';

import SharedDiagnosis from './pages/SharedDiagnosis';

// Placeholder components for routes
const Fields = () => <div className="p-4">Fields Page</div>;
const Profile = () => <div className="p-4">Profile Page</div>;
const Privacy = () => <div className="p-4">Privacy Policy</div>;
const Terms = () => <div className="p-4">Terms of Service</div>;

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
  );
}
