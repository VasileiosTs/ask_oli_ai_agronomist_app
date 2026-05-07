import { describe, expect, it } from 'vitest';
import {
  formatTierLabel,
  isKnownTier,
  isUnlimitedTier,
  UNLIMITED_TIERS,
} from '../../shared/subscription';

describe('subscription helpers', () => {
  it('treats all paid tiers as unlimited', () => {
    expect(UNLIMITED_TIERS).toEqual(['pro', 'master', 'enterprise']);
    expect(isUnlimitedTier('pro')).toBe(true);
    expect(isUnlimitedTier('master')).toBe(true);
    expect(isUnlimitedTier('enterprise')).toBe(true);
    expect(isUnlimitedTier('free')).toBe(false);
  });

  it('recognizes supported tiers and formats labels', () => {
    expect(isKnownTier('free')).toBe(true);
    expect(isKnownTier('master')).toBe(true);
    expect(isKnownTier('enterprise')).toBe(true);
    expect(isKnownTier('legacy')).toBe(false);
    expect(formatTierLabel('master')).toBe('MASTER');
    expect(formatTierLabel('pro')).toBe('PRO');
    expect(formatTierLabel('free')).toBe('STARTER');
  });
});
