// PostHog analytics wrapper
// Replace POSTHOG_KEY with your actual key from posthog.com

import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';

let initialized = false;

export function initAnalytics() {
  if (initialized || !POSTHOG_KEY || !import.meta.env.PROD) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage',
    autocapture: false, // we track events manually for precision
  });
  initialized = true;
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.identify(userId, properties);
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function resetAnalytics() {
  if (!initialized) return;
  posthog.reset();
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
