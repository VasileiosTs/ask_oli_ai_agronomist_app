import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';
import { initSentry } from './lib/sentry';
import { initAnalytics } from './lib/analytics';
import App from './App.tsx';
import './index.css';

initSentry();
// analytics.ts uses dynamic import for posthog-js internally, so this call
// doesn't add posthog to the initial JS bundle — it only loads when PROD + key set.
initAnalytics();

// Register service worker for PWA install + push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Check for updates every 5 minutes
      setInterval(() => { reg.update().catch(() => {}); }, 5 * 60 * 1000);
    }).catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
