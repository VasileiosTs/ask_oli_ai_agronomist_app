// Shared constants — single source of truth
// Edge function has its own copy (separate Deno runtime)

// ── Tier limits ──
export const TIER_LIMITS = {
  free:       { messagesPerWeek: 10, fields: 3, historyDays: 7, reportsPerMonth: 1 },
  pro:        { messagesPerWeek: Infinity, fields: Infinity, historyDays: Infinity, reportsPerMonth: Infinity },
  agronomist: { messagesPerWeek: Infinity, fields: Infinity, historyDays: Infinity, reportsPerMonth: Infinity },
  enterprise: { messagesPerWeek: Infinity, fields: Infinity, historyDays: Infinity, reportsPerMonth: Infinity },
} as const;

export type Tier = keyof typeof TIER_LIMITS;

export function getTierLimits(tier: string) {
  return TIER_LIMITS[(tier as Tier)] ?? TIER_LIMITS.free;
}

/** @deprecated Use getTierLimits(tier).messagesPerWeek instead */
export const FREE_MESSAGE_LIMIT = 10;    // messages per week on free tier
export const VIO_STEP1_DAYS = 3;         // days after logging → "did you apply?"
export const VIO_STEP2_DAYS = 3;         // days after apply confirm → "any improvement?"
export const MAX_ATTACHMENTS = 3;        // max files per message
export const MAX_CONVERSATION_HISTORY = 10; // messages sent to AI context
export const SIGNED_URL_EXPIRY = 604800; // seconds (7 days) for storage signed URLs

// Allowed MIME types for file uploads
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf'] as const;
export const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES] as const;
export const ALLOWED_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
