import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';
import { initSentry } from './lib/sentry';
import App from './App.tsx';
import './index.css';

initSentry();

// Register service worker for PWA install + offline fallback
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
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
