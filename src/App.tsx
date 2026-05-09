import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import { LanguageProvider } from './lib/LanguageContext';
import { hasValidStoredAuthSession } from './lib/authStorage';

const Landing = lazy(() => import('./pages/Landing'));
// AuthenticatedShell is lazy — Supabase only loads when user leaves the landing page
const AuthenticatedShell = lazy(() => import('./AuthenticatedShell'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen bg-[#0D1117]" />}>
            <Routes>
              {/* Landing — renders with zero Supabase JS for fast mobile paint */}
              <Route
                path="/"
                element={hasValidStoredAuthSession() ? <Navigate to="/chat" replace /> : <Landing />}
              />
              {/* All other routes — lazy-loads AuthProvider + Supabase only when needed */}
              <Route path="/*" element={<AuthenticatedShell />} />
            </Routes>
          </Suspense>
          <Analytics />
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
