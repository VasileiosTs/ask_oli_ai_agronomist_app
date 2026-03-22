import * as Sentry from '@sentry/react';

export function initSentry() {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: 'https://69cf6c75e1b67584858ba32bd257d337@o4511089240768513.ingest.de.sentry.io/4511089250205776',
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
