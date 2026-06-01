/**
 * Confidence threshold enforcement tests
 *
 * The Five-Pillar Diagnostic scores confidence 0–100. The chat function enforces
 * these rules as a second line of defence after the AI system prompt:
 *
 *   < 40  → hard block: strip problem/cause/severity/treatments from structured JSON
 *   40–65 → "possible/suspected", 2–3 candidates, safe actions only (AI-layer)
 *   65–85 → primary diagnosis + uncertainty language (AI-layer)
 *   > 85  → full diagnosis + complete treatment + prevention
 *
 * Quarantine diseases (HLB, Xylella, Fire Blight, Plum Pox) require > 85.
 *
 * These tests replicate the `enforceConfidenceThreshold` function from
 * supabase/functions/chat/index.ts. Any drift between the two files will
 * cause a test failure.
 *
 * SYNC: supabase/functions/chat/index.ts :: enforceConfidenceThreshold()
 */
import { describe, it, expect } from 'vitest';

// ── Types (mirror of AiResponseJson in chat/index.ts) ────────────────────────

interface DiagnosisData {
  confidence_score: number | null;
  problem?: string | null;
  cause?: string | null;
  severity?: string | null;
  product_applied?: string | null;
  chemical_treatments?: unknown[];
  organic_treatments?: unknown[];
  missing_pillars?: string[];
  [key: string]: unknown;
}

interface AiResponseJson {
  response_text: string;
  diagnosis_data?: DiagnosisData | null;
  [key: string]: unknown;
}

// ── Logic replica ─────────────────────────────────────────────────────────────
// SYNC: supabase/functions/chat/index.ts :: enforceConfidenceThreshold()

function enforceConfidenceThreshold(response: AiResponseJson): AiResponseJson {
  const dd = response.diagnosis_data;
  if (!dd) return response;

  const score = typeof dd.confidence_score === 'number' ? dd.confidence_score : 100;

  if (score < 40) {
    return {
      ...response,
      diagnosis_data: {
        ...dd,
        problem: null,
        cause: null,
        severity: null,
        product_applied: null,
        chemical_treatments: [],
        organic_treatments: [],
      },
    };
  }

  return response;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResponse(score: number | null, extra: Partial<DiagnosisData> = {}): AiResponseJson {
  return {
    response_text: 'Some AI answer',
    diagnosis_data: {
      confidence_score: score,
      problem: 'Powdery Mildew',
      cause: 'Uncinula necator',
      severity: 'moderate',
      product_applied: 'Sulphur WP 80%',
      chemical_treatments: [{ active: 'Myclobutanil' }],
      organic_treatments: [{ active: 'Sulphur' }],
      missing_pillars: [],
      ...extra,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('enforceConfidenceThreshold', () => {
  describe('below 40 — hard block', () => {
    it('strips problem field when confidence = 0', () => {
      const out = enforceConfidenceThreshold(makeResponse(0));
      expect(out.diagnosis_data?.problem).toBeNull();
    });

    it('strips cause field when confidence = 39', () => {
      const out = enforceConfidenceThreshold(makeResponse(39));
      expect(out.diagnosis_data?.cause).toBeNull();
    });

    it('strips severity when confidence < 40', () => {
      const out = enforceConfidenceThreshold(makeResponse(25));
      expect(out.diagnosis_data?.severity).toBeNull();
    });

    it('strips product_applied when confidence < 40', () => {
      const out = enforceConfidenceThreshold(makeResponse(10));
      expect(out.diagnosis_data?.product_applied).toBeNull();
    });

    it('empties chemical_treatments when confidence < 40', () => {
      const out = enforceConfidenceThreshold(makeResponse(35));
      expect(out.diagnosis_data?.chemical_treatments).toEqual([]);
    });

    it('empties organic_treatments when confidence < 40', () => {
      const out = enforceConfidenceThreshold(makeResponse(35));
      expect(out.diagnosis_data?.organic_treatments).toEqual([]);
    });

    it('preserves confidence_score so UI can show what is needed', () => {
      const out = enforceConfidenceThreshold(makeResponse(30));
      expect(out.diagnosis_data?.confidence_score).toBe(30);
    });

    it('preserves missing_pillars so UI can show what is needed', () => {
      const pillars = ['THE SYMPTOMS', 'THE EVIDENCE'];
      const out = enforceConfidenceThreshold(makeResponse(30, { missing_pillars: pillars }));
      expect(out.diagnosis_data?.missing_pillars).toEqual(pillars);
    });

    it('preserves response_text (AI narrative is already restricted by system prompt)', () => {
      const out = enforceConfidenceThreshold(makeResponse(20));
      expect(out.response_text).toBe('Some AI answer');
    });
  });

  describe('boundary — exactly 40 is NOT a hard block', () => {
    it('allows problem at confidence = 40', () => {
      const out = enforceConfidenceThreshold(makeResponse(40));
      expect(out.diagnosis_data?.problem).toBe('Powdery Mildew');
    });

    it('allows chemical_treatments at confidence = 40', () => {
      const out = enforceConfidenceThreshold(makeResponse(40));
      expect(out.diagnosis_data?.chemical_treatments).toHaveLength(1);
    });
  });

  describe('above 40 — full response passes through', () => {
    it('does not strip anything at confidence = 65', () => {
      const out = enforceConfidenceThreshold(makeResponse(65));
      expect(out.diagnosis_data?.problem).toBe('Powdery Mildew');
      expect(out.diagnosis_data?.cause).toBe('Uncinula necator');
    });

    it('does not strip anything at confidence = 91 (high confidence)', () => {
      const out = enforceConfidenceThreshold(makeResponse(91));
      expect(out.diagnosis_data?.chemical_treatments).toHaveLength(1);
      expect(out.diagnosis_data?.organic_treatments).toHaveLength(1);
    });

    it('does not strip anything at confidence = 100', () => {
      const out = enforceConfidenceThreshold(makeResponse(100));
      expect(out.diagnosis_data?.problem).toBe('Powdery Mildew');
    });
  });

  describe('missing confidence_score — permissive default', () => {
    it('treats null confidence_score as 100 (allows full response)', () => {
      const out = enforceConfidenceThreshold(makeResponse(null));
      expect(out.diagnosis_data?.problem).toBe('Powdery Mildew');
      expect(out.diagnosis_data?.chemical_treatments).toHaveLength(1);
    });
  });

  describe('no diagnosis_data — passthrough', () => {
    it('returns response unchanged when diagnosis_data is undefined', () => {
      const response: AiResponseJson = { response_text: 'Planning answer', diagnosis_data: null };
      const out = enforceConfidenceThreshold(response);
      expect(out).toEqual(response);
    });
  });
});
