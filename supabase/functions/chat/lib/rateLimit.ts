import {
  FREE_MESSAGE_LIMIT,
  isUnlimitedTier,
} from '../../../../shared/subscription.ts';
import type { AppUserRow } from './types.ts';

export function sameCalendarMonth(a: Date | null, b: Date): boolean {
  return !!a && a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

export function getCurrentMonthlyMessageCount(appUser: AppUserRow, now: Date): number {
  const resetDate = appUser.message_reset_date ? new Date(appUser.message_reset_date) : null;
  return sameCalendarMonth(resetDate, now) ? appUser.message_count_month ?? 0 : 0;
}

export function assertMonthlyUsageAllowed(appUser: AppUserRow, currentCount: number) {
  if (isUnlimitedTier(appUser.tier)) {
    return;
  }

  if (currentCount >= FREE_MESSAGE_LIMIT) {
    const error = new Error('Monthly message limit reached');
    Object.assign(error, {
      status: 429,
      code: 'monthly_limit',
      limit: FREE_MESSAGE_LIMIT,
    });
    throw error;
  }
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

  if (!lastMsg) {
    return;
  }

  const elapsed = Date.now() - new Date(lastMsg.created_at).getTime();
  if (elapsed >= minIntervalMs) {
    return;
  }

  const error = new Error('Please wait a moment before sending another message');
  Object.assign(error, {
    status: 429,
    code: 'burst_rate_limit',
  });
  throw error;
}

export async function incrementMonthlyMessageCount(
  supabaseAdmin: any,
  appUserId: string,
  nextMessageCount: number,
  now: Date,
) {
  await supabaseAdmin
    .from('users')
    .update({
      message_count_month: nextMessageCount,
      message_reset_date: now.toISOString(),
    })
    .eq('id', appUserId);
}
