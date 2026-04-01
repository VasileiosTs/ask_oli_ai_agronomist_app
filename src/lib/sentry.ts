import * as Sentry from '@sentry/react';

export function initSentry() {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN as string,
      environment: 'production',
      // Only capture errors, not performance (free tier friendly)
      tracesSampleRate: 0,
      // Don't send errors from localhost
      beforeSend(event) {
        if (event.request?.url?.includes('localhost')) return null;
        return event;
      },
    });
  }
}

export { Sentry };
