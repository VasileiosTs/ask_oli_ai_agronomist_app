import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import { LanguageProvider } from './lib/LanguageContext';

const Landing = lazy(() => import('./pages/Landing'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
// AuthenticatedShell is lazy — Supabase only loads when user leaves the landing page
const AuthenticatedShell = lazy(() => import('./AuthenticatedShell'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } },
});

/** Check localStorage for a non-expired Supabase session without importing Supabase. */
function hasValidStoredSession(): boolean {
  try {
    const key = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (!key) return false;
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { expires_at?: number } | null;
    if (!parsed?.expires_at) return false;
    // Valid if not expiring within the next 60 seconds
    return parsed.expires_at > Date.now() / 1000 + 60;
  } catch {
    return false;
  }
}

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
                element={hasValidStoredSession() ? <Navigate to="/chat" replace /> : <Landing />}
              />
              {/* Legal pages — fully public, no auth loading, accessible to crawlers */}
              <Route path="/legal/privacy" element={<Privacy />} />
              <Route path="/legal/terms" element={<Terms />} />
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
