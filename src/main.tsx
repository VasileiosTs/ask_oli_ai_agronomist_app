import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';
import { initSentry } from './lib/sentry';
import { initAnalytics } from './lib/analytics';
import App from './App.tsx';
import './index.css';

initSentry();
initAnalytics();

// Register service worker for PWA install + push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Check for updates every 5 minutes so users always get fresh content
      setInterval(() => reg.update(), 5 * 60 * 1000);

      // When a new SW is waiting, activate it immediately so the next
      // navigation (or reload) serves the latest version — no hard reset needed
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            // New version active — the next navigation will use it automatically.
            // For SPA: reload once so the user gets new HTML + JS without manual hard reset.
            window.location.reload();
          }
        });
      });
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
