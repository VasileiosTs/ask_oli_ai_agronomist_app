import { describe, it, expect } from 'vitest';
import { Events } from '../lib/analytics';

describe('analytics events', () => {
  it('has all required event names', () => {
    const required = [
      'SIGNUP', 'LOGIN', 'MESSAGE_SENT', 'INTERVENTION_LOGGED',
      'VIO_OUTCOME_RECORDED', 'FEEDBACK_POSITIVE', 'FEEDBACK_NEGATIVE',
      'SHARE_DIAGNOSIS', 'PAYWALL_HIT',
    ];
    for (const key of required) {
      expect(Events).toHaveProperty(key);
      expect(typeof (Events as any)[key]).toBe('string');
    }
  });

  it('event values are non-empty strings', () => {
    for (const [key, val] of Object.entries(Events)) {
      expect(typeof val, `Events.${key} should be string`).toBe('string');
      expect((val as string).length, `Events.${key} is empty`).toBeGreaterThan(0);
    }
  });
});
