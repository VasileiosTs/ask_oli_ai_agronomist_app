import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import { LanguageProvider } from './lib/LanguageContext';

// AuthenticatedShell owns ALL routing — including the landing page redirect for
// authenticated users. Keeping the "/" route here and doing a synchronous
// hasValidStoredAuthSession() check caused a double-redirect: the sync check
// could fail on a post-refresh session shape, show Landing briefly, then
// AuthenticatedShell would redirect to /chat — visibly bouncing the user.
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
              {/* All routes — AuthenticatedShell handles "/" and redirects for auth state */}
              <Route path="/*" element={<AuthenticatedShell />} />
            </Routes>
          </Suspense>
          <Analytics />
        </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
