// Type declaration for the Google gtag global function injected by index.html.
// Keeps ConsentBanner and any future gtag calls type-safe without importing
// the full @types/gtag.js package.

interface Window {
  gtag: (
    command: 'consent' | 'config' | 'event' | 'js' | 'set',
    action: string | Date,
    params?: Record<string, unknown>
  ) => void;
  dataLayer: unknown[];
}
