export const SUPPORT_EMAIL = 'hello@askoli.ai';

export const FREE_MESSAGE_LIMIT = 20;
export const FREE_MESSAGE_LIMIT_PERIOD = 'month' as const;

export const UNLIMITED_TIERS = ['pro', 'agronomist', 'enterprise'] as const;

export type AppTier = 'free' | (typeof UNLIMITED_TIERS)[number];

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
    case 'agronomist':
      return 'AGRONOMIST';
    case 'enterprise':
      return 'ENTERPRISE';
    default:
      return 'FREE';
  }
}
