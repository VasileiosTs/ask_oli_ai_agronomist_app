import { describe, it, expect } from 'vitest';
import { FREE_MESSAGE_LIMIT, VIO_STEP1_DAYS, VIO_STEP2_DAYS, MAX_ATTACHMENTS, MAX_CONVERSATION_HISTORY } from '../lib/constants';

describe('constants', () => {
  it('has correct free message limit', () => {
    expect(FREE_MESSAGE_LIMIT).toBe(20);
  });

  it('VIO step days are 3 each', () => {
    expect(VIO_STEP1_DAYS).toBe(3);
    expect(VIO_STEP2_DAYS).toBe(3);
  });

  it('has sensible attachment and history limits', () => {
    expect(MAX_ATTACHMENTS).toBe(3);
    expect(MAX_CONVERSATION_HISTORY).toBe(10);
  });
});
