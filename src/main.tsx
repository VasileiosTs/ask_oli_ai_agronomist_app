import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { AuthProvider } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';
import { initSentry } from './lib/sentry';
import { initAnalytics } from './lib/analytics';
import i18n from './lib/i18next';
import App from './App.tsx';
import './index.css';

initSentry();
// analytics.ts uses dynamic import for posthog-js internally, so this call
// doesn't add posthog to the initial JS bundle — it only loads when PROD + key set.
initAnalytics();

// Register service worker for PWA install + push notifications
if ('serviceWorker' in navigator) {
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) {
      return;
    }

    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Check for updates every 5 minutes
      setInterval(() => { reg.update().catch(() => {}); }, 5 * 60 * 1000);
    }).catch((err) => {
      console.warn('SW registration failed:', err);
    });

    // Was there already a SW controlling this page at load time?
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;

    // controllerchange fires when a new SW calls clients.claim() and takes over.
    // - First install (hadController=false): reload silently — page just loaded, no user input lost.
    // - Genuine update (hadController=true): dispatch event so the app shows an update banner.
    //   We don't force-reload here because the user may be mid-conversation.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      if (hadController) {
        window.dispatchEvent(new CustomEvent('sw-update'));
      } else {
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </I18nextProvider>
  </StrictMode>,
);
