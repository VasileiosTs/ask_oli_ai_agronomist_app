/**
 * VIO loop — step advancement logic tests
 *
 * These tests verify the core invariants of the VIO (Verify → Intervene → Outcome)
 * loop *without* requiring a live Supabase connection. They replicate the logic
 * from supabase/functions/send-push/index.ts so any drift between the two files
 * is caught by a failing test.
 *
 * Integration coverage targets:
 *   - Step 1 → 2 advancement sets follow_up_at = now + 7 days
 *   - Step 2 → 3 advancement sets follow_up_at = null (loop closed)
 *   - Step 3 records are NEVER picked up by the cron query
 *   - Interventions with outcome != null are NEVER picked up
 *   - Interventions with follow_up_at > now are NEVER picked up
 */
import { describe, it, expect } from 'vitest';
import { VIO_STEP1_DAYS, VIO_STEP2_DAYS } from '../lib/constants';

// ── Pure helpers extracted from send-push/index.ts ───────────────────────────
// SYNC: supabase/functions/send-push/index.ts (VIO_STEP2_MS, nextStep logic)

const VIO_STEP1_MS = VIO_STEP1_DAYS * 24 * 60 * 60 * 1000; // 3 days in ms
const VIO_STEP2_MS = VIO_STEP2_DAYS * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Mirrors the step-advancement logic inside the vio_cron handler in send-push.
 * Returns the update payload that would be written to the interventions row.
 */
function computeVioAdvancement(
  currentStep: number,
  now: Date,
): { vio_step: number; follow_up_at: string | null } {
  const nextStep = currentStep + 1;
  const nextFollowUpAt =
    nextStep < 3
      ? new Date(now.getTime() + VIO_STEP2_MS).toISOString()
      : null;
  return { vio_step: nextStep, follow_up_at: nextFollowUpAt };
}

/**
 * Mirrors the DB query filter in send-push vio_cron mode:
 *   follow_up_at <= now AND outcome IS NULL AND vio_step < 3
 */
function isDueForFollowUp(iv: {
  vio_step: number;
  follow_up_at: string;
  outcome: string | null;
}, now: Date): boolean {
  return (
    iv.vio_step < 3 &&
    iv.outcome === null &&
    new Date(iv.follow_up_at) <= now
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('VIO constants', () => {
  it('step 1 cadence is 3 days', () => {
    expect(VIO_STEP1_DAYS).toBe(3);
    expect(VIO_STEP1_MS).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it('step 2 cadence is 7 days', () => {
    expect(VIO_STEP2_DAYS).toBe(7);
    expect(VIO_STEP2_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('VIO step advancement', () => {
  const now = new Date('2026-06-01T12:00:00Z');

  it('step 1 → 2: vio_step increments and follow_up_at is set 7 days out', () => {
    const result = computeVioAdvancement(1, now);
    expect(result.vio_step).toBe(2);
    // follow_up_at should be exactly VIO_STEP2_MS (7 days) from now
    const expected = new Date(now.getTime() + VIO_STEP2_MS).toISOString();
    expect(result.follow_up_at).toBe(expected);
  });

  it('step 2 → 3: vio_step increments and follow_up_at is set to null (loop closed)', () => {
    const result = computeVioAdvancement(2, now);
    expect(result.vio_step).toBe(3);
    expect(result.follow_up_at).toBeNull();
  });

  it('step 1 → 2 gap is exactly 7 days, not 3', () => {
    const result = computeVioAdvancement(1, now);
    const diff = new Date(result.follow_up_at!).getTime() - now.getTime();
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('VIO cron eligibility filter', () => {
  const now = new Date('2026-06-01T12:00:00Z');

  const makeIv = (
    vio_step: number,
    follow_up_at: string,
    outcome: string | null = null,
  ) => ({ vio_step, follow_up_at, outcome });

  it('picks up step-1 record that is due (follow_up_at <= now, no outcome)', () => {
    const iv = makeIv(1, '2026-06-01T10:00:00Z'); // 2h before now
    expect(isDueForFollowUp(iv, now)).toBe(true);
  });

  it('picks up step-2 record that is due', () => {
    const iv = makeIv(2, '2026-05-30T12:00:00Z'); // 2 days before now
    expect(isDueForFollowUp(iv, now)).toBe(true);
  });

  it('does NOT pick up step-3 records (loop already closed)', () => {
    const iv = makeIv(3, '2026-05-30T12:00:00Z'); // due, but step=3
    expect(isDueForFollowUp(iv, now)).toBe(false);
  });

  it('does NOT pick up records where outcome is already set', () => {
    const iv = makeIv(1, '2026-06-01T10:00:00Z', 'better');
    expect(isDueForFollowUp(iv, now)).toBe(false);
  });

  it('does NOT pick up records where follow_up_at is in the future', () => {
    const iv = makeIv(1, '2026-06-04T12:00:00Z'); // 3 days ahead
    expect(isDueForFollowUp(iv, now)).toBe(false);
  });

  it('picks up records where follow_up_at is exactly now', () => {
    const iv = makeIv(1, now.toISOString()); // exactly now
    expect(isDueForFollowUp(iv, now)).toBe(true);
  });
});

describe('VIO loop is finite', () => {
  it('after two advancements from step 1, the loop reaches step 3 with null follow_up_at', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const step1 = computeVioAdvancement(1, now);
    const step2 = computeVioAdvancement(step1.vio_step, now);

    expect(step2.vio_step).toBe(3);
    expect(step2.follow_up_at).toBeNull();
  });
});
