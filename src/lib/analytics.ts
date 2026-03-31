// PostHog analytics wrapper — posthog-js is dynamically imported so it
// doesn't end up in the static module graph of the landing page.

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ph: any = null;

export async function initAnalytics() {
  if (ph || !POSTHOG_KEY || !import.meta.env.PROD) return;
  const { default: posthog } = await import('posthog-js');
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage',
    autocapture: false,
  });
  ph = posthog;
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  ph?.identify(userId, properties);
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  ph?.capture(event, properties);
}

export function resetAnalytics() {
  ph?.reset();
}

// Predefined events for consistency
export const Events = {
  SIGNUP: 'signup',
  LOGIN: 'login',
  FIRST_MESSAGE: 'first_message',
  FIRST_PHOTO: 'first_photo_uploaded',
  MESSAGE_SENT: 'message_sent',
  DIAGNOSIS_RECEIVED: 'diagnosis_received',
  INTERVENTION_LOGGED: 'intervention_logged',
  VIO_APPLIED_CONFIRMED: 'vio_applied_confirmed',
  VIO_IMPROVEMENT_CHECKED: 'vio_improvement_checked',
  VIO_OUTCOME_RECORDED: 'vio_outcome_recorded',
  FEEDBACK_POSITIVE: 'feedback_positive',
  FEEDBACK_NEGATIVE: 'feedback_negative',
  SHARE_DIAGNOSIS: 'share_diagnosis',
  PAYWALL_HIT: 'paywall_hit',
  PAYWALL_UPGRADE_CLICK: 'paywall_upgrade_click',
  INSTALL_PWA: 'install_pwa',
  VOICE_INPUT: 'voice_input',
  FIELD_CREATED: 'field_created',
  SIGNUP_FROM_SHARE: 'signup_from_share',
} as const;
