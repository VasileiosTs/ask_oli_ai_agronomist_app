import { describe, it, expect, vi } from 'vitest';

// Mock supabase before importing fieldContext
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ data: [], error: null }) }) }) },
}));

import { formatFieldContextBlock } from '../lib/fieldContext';

describe('formatFieldContextBlock', () => {
  it('formats a full field correctly', () => {
    const field = {
      id: '1', name: 'North Plot', crop_type: 'Olives',
      size_ha: 2.5, soil_type: 'loamy', irrigation_type: 'drip',
      growing_medium: 'soil', last_diagnosis: 'olive knot',
    };
    const result = formatFieldContextBlock(field);
    expect(result).toContain('North Plot');
    expect(result).toContain('Olives');
    expect(result).toContain('2.5ha');
    expect(result).toContain('loamy');
    expect(result).toContain('drip');
    expect(result).toContain('olive knot');
  });

  it('handles missing fields with N/A', () => {
    const field = {
      id: '2', name: 'Empty', crop_type: '',
      size_ha: 0, soil_type: '', irrigation_type: '',
      growing_medium: '', last_diagnosis: '',
    };
    const result = formatFieldContextBlock(field);
    expect(result).toContain('N/A');
    expect(result).toContain('Empty');
  });
});
