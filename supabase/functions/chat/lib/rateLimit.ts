// supabase/functions/chat/lib/rateLimit.ts
//
// Changes from original:
//  1. incrementMonthlyMessageCount now calls the increment_message_count RPC
//     (atomic, uses FOR UPDATE locking) instead of a raw UPDATE.  The old
//     UPDATE had a race condition when two tabs sent messages simultaneously.
//  2. Added getPaywallWarning() — returns a non-null warning object when the
//     user has PAYWALL_WARNING_MESSAGES_REMAINING or fewer messages left.
//     The chat edge function should attach this to the SSE stream metadata so
//     the frontend can show the soft warning banner.
//  3. sameCalendarMonth and getCurrentMonthlyMessageCount are unchanged.
//  4. assertBurstRateLimit is unchanged.

import {
  FREE_MESSAGE_LIMIT,
  isUnlimitedTier,
} from '../../../../shared/subscription.ts';
import type { AppUserRow } from './types.ts';

/** Number of messages remaining at which we show the soft paywall warning. */
const PAYWALL_WARNING_THRESHOLD = 3;

export function sameCalendarMonth(a: Date | null, b: Date): boolean {
  return !!a && a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

export function getCurrentMonthlyMessageCount(appUser: AppUserRow, now: Date): number {
  const resetDate = appUser.message_reset_date ? new Date(appUser.message_reset_date) : null;
  return sameCalendarMonth(resetDate, now) ? (appUser.message_count_month ?? 0) : 0;
}

export function assertMonthlyUsageAllowed(appUser: AppUserRow, currentCount: number) {
  if (isUnlimitedTier(appUser.tier)) return;

  if (currentCount >= FREE_MESSAGE_LIMIT) {
    const error = new Error('Monthly message limit reached');
    Object.assign(error, { status: 429, code: 'monthly_limit', limit: FREE_MESSAGE_LIMIT });
    throw error;
  }
}

/**
 * Returns a warning payload when the user is running low on free messages,
 * or null if no warning is needed.  Attach this to your SSE stream metadata
 * so the frontend can display the soft paywall banner.
 */
export function getPaywallWarning(
  appUser: AppUserRow,
  currentCount: number,
): { messagesRemaining: number; limit: number } | null {
  if (isUnlimitedTier(appUser.tier)) return null;
  const remaining = FREE_MESSAGE_LIMIT - currentCount;
  if (remaining > PAYWALL_WARNING_THRESHOLD) return null;
  return { messagesRemaining: remaining, limit: FREE_MESSAGE_LIMIT };
}

export async function assertBurstRateLimit(
  supabaseAdmin: any,
  appUserId: string,
  minIntervalMs = 2000,
) {
  const { data: lastMsg } = await supabaseAdmin
    .from('chat_messages')
    .select('created_at')
    .eq('user_id', appUserId)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastMsg) return;

  const elapsed = Date.now() - new Date(lastMsg.created_at).getTime();
  if (elapsed >= minIntervalMs) return;

  const error = new Error('Please wait a moment before sending another message');
  Object.assign(error, { status: 429, code: 'burst_rate_limit' });
  throw error;
}

/**
 * Atomically increments the monthly message count via a PL/pgSQL function
 * that uses SELECT … FOR UPDATE to prevent double-counting under concurrent
 * requests.  Falls back silently so a DB error never blocks a chat response.
 *
 * The RPC signature is:
 *   increment_message_count(p_user_id uuid, p_now timestamptz)
 *   RETURNS void
 */
export async function incrementMonthlyMessageCount(
  supabaseAdmin: any,
  appUserId: string,
  _nextMessageCount: number, // kept for API compatibility — ignored; RPC does the math
  now: Date,
) {
  const { error } = await supabaseAdmin.rpc('increment_message_count', {
    p_user_id: appUserId,
    p_now: now.toISOString(),
  });
  if (error) {
    // Log but don't throw — a counter failure must not break the user's chat
    console.error('[rateLimit] increment_message_count RPC failed:', error.message);
  }
}
