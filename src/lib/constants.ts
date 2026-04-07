import {
  FREE_MESSAGE_LIMIT,
  FREE_MESSAGE_LIMIT_PERIOD,
} from '../../shared/subscription';

// ── Tier limits ──
// NOTE: the enforced period is MONTHLY (FREE_MESSAGE_LIMIT_PERIOD === 'month').
// The key is intentionally `messagesPerMonth` to match what the edge function
// actually enforces. Do NOT rename it back to messagesPerWeek.
export const TIER_LIMITS = {
  free:       { messagesPerMonth: FREE_MESSAGE_LIMIT, fields: 3, historyDays: 7,       reportsPerMonth: 1        },
  pro:        { messagesPerMonth: Infinity,           fields: Infinity, historyDays: Infinity, reportsPerMonth: Infinity },
  agronomist: { messagesPerMonth: Infinity,           fields: Infinity, historyDays: Infinity, reportsPerMonth: Infinity },
  enterprise: { messagesPerMonth: Infinity,           fields: Infinity, historyDays: Infinity, reportsPerMonth: Infinity },
} as const;

export type Tier = keyof typeof TIER_LIMITS;

export function getTierLimits(tier: string) {
  return TIER_LIMITS[(tier as Tier)] ?? TIER_LIMITS.free;
}

export { FREE_MESSAGE_LIMIT, FREE_MESSAGE_LIMIT_PERIOD };

// ── VIO follow-up cadence ──
// Step 1 (3 days after logging):  "Did you apply the treatment?"
// Step 2 (3 days after applying): "Has there been any improvement?"
// Both steps = 6 days total. The 13-day figure in old TODOS was stale — ignore it.
export const VIO_STEP1_DAYS = 3;
export const VIO_STEP2_DAYS = 3;

// ── Paywall warning thresholds ──
// Show a soft warning when the user has this many messages left.
export const PAYWALL_WARNING_MESSAGES_REMAINING = 3;

// ── File upload limits ──
export const MAX_ATTACHMENTS = 3;
export const MAX_CONVERSATION_HISTORY = 10;
export const SIGNED_URL_EXPIRY = 604_800; // 7 days in seconds

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf'] as const;
export const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES] as const;
export const ALLOWED_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Memory snapshot retention ──
export const MEMORY_SNAPSHOT_MAX_PER_FIELD = 100; // oldest deleted when exceeded
export const MEMORY_SNAPSHOT_RETENTION_DAYS = 90;

// ── Greeting cache TTL ──
export const GREETING_CACHE_TTL_HOURS = 24;
