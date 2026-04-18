import * as Sentry from '@sentry/react';

export function initSentry() {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN as string,
      environment: 'production',
      // Only capture errors, not performance (free tier friendly)
      tracesSampleRate: 0,
      // Never send PII automatically (IPs, user-agent, etc.)
      sendDefaultPii: false,
      // Don't send errors from localhost
      beforeSend(event) {
        if (event.request?.url?.includes('localhost')) return null;
        // Strip query strings from request URLs before sending (they can contain
        // field IDs, share tokens, user input passed via ?q= params)
        if (event.request?.url) {
          try {
            const u = new URL(event.request.url);
            u.search = '';
            event.request.url = u.toString();
          } catch { /* ignore malformed URLs */ }
        }
        return event;
      },
      // Drop console breadcrumbs (can capture raw Supabase error objects with
      // user IDs / message IDs) and strip query strings from navigation/fetch crumbs
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.category === 'console') return null;
        if (breadcrumb.data?.url) {
          try {
            const u = new URL(breadcrumb.data.url as string);
            u.search = '';
            breadcrumb.data.url = u.toString();
          } catch { /* ignore */ }
        }
        return breadcrumb;
      },
    });
  }
}

export function trackError(error: unknown, extras?: Record<string, unknown>) {
  console.error(error);

  if (!import.meta.env.PROD) {
    return;
  }

  Sentry.withScope((scope) => {
    if (extras) {
      scope.setExtras(extras);
    }

    if (error instanceof Error) {
      Sentry.captureException(error);
      return;
    }

    Sentry.captureMessage(typeof error === 'string' ? error : 'Unknown client error');
  });
}

export { Sentry };
