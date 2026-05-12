import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import { LanguageProvider } from './lib/LanguageContext';
import ConsentBanner from './components/ConsentBanner';

// AuthenticatedShell owns ALL routing — including the landing page redirect for
// authenticated users. Keeping the "/" route here and doing a synchronous
// hasValidStoredAuthSession() check caused a double-redirect: the sync check
// could fail on a post-refresh session shape, show Landing briefly, then
// AuthenticatedShell would redirect to /chat — visibly bouncing the user.
const AuthenticatedShell = lazy(() => import('./AuthenticatedShell'));

// Legal pages are hoisted here so they render without waiting for the
// Supabase auth check inside AuthenticatedShell — required for Google
// OAuth verification crawlers to reach /legal/privacy and /legal/terms.
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));

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
              {/* Legal pages — public, no auth loading, accessible to crawlers */}
              <Route path="/legal/privacy" element={<Privacy />} />
              <Route path="/legal/terms" element={<Terms />} />
              {/* All other routes — AuthenticatedShell handles "/" and auth state */}
              <Route path="/*" element={<AuthenticatedShell />} />
            </Routes>
          </Suspense>
          <Analytics />
          {/* GDPR consent banner — shows once on first visit, dismissed permanently on choice */}
          <ConsentBanner />
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
