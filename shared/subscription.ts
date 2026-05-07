export const SUPPORT_EMAIL = 'hello@ask-oli.com';

export const FREE_MESSAGE_LIMIT = 20;
export const FREE_MESSAGE_LIMIT_PERIOD = 'month' as const;

export const UNLIMITED_TIERS = ['pro', 'master', 'enterprise'] as const;

export type AppTier = 'free' | (typeof UNLIMITED_TIERS)[number];

/** Tiers that get the advisor/grower-management view instead of the farmer view */
export const ADVISOR_TIERS = ['master', 'enterprise'] as const;

export function isAdvisorTier(tier?: string | null): boolean {
  return (ADVISOR_TIERS as readonly string[]).includes(tier ?? '');
}

export function isUnlimitedTier(tier?: string | null): boolean {
  if (!tier) {
    return false;
  }

  return (UNLIMITED_TIERS as readonly string[]).includes(tier);
}

export function isKnownTier(tier?: string | null): tier is AppTier {
  return tier === 'free' || isUnlimitedTier(tier);
}

export function formatTierLabel(tier?: string | null): string {
  switch (tier) {
    case 'pro':
      return 'PRO';
    case 'master':
      return 'MASTER';
    case 'enterprise':
      return 'ENTERPRISE';
    default:
      return 'STARTER';
  }
}
