import { describe, it, expect } from 'vitest';
import { buildPlanFileHtml } from '../lib/planFile';

describe('buildPlanFileHtml', () => {
  const body = '<h2>Spray schedule</h2><p>Δραστική ουσία: Copper</p>';

  it('injects the pre-rendered plan body verbatim (already sanitized upstream)', () => {
    const html = buildPlanFileHtml(body, 'Vasileios', 'en');
    expect(html).toContain(body);
  });

  it('wraps the plan in the Oli brand shell with the ask-oli.com footer', () => {
    const html = buildPlanFileHtml(body, 'Vasileios', 'en');
    expect(html).toContain('class="logo">Oli');
    expect(html).toContain('ask-oli.com');
    expect(html).toContain('Your AI Agronomist');
    expect(html).toContain('Cultivation Plan');
    expect(html).toContain('Vasileios');
  });

  it('localizes the title and footer for Greek', () => {
    const html = buildPlanFileHtml(body, 'Γιώργος', 'el');
    expect(html).toContain('Πρόγραμμα Καλλιέργειας');
    expect(html).toContain('Δημιουργήθηκε από το Oli');
    expect(html).toContain('Ο AI Γεωπόνος σου');
  });

  it('escapes a user-controlled name to prevent HTML injection', () => {
    const html = buildPlanFileHtml(body, '<script>alert(1)</script>', 'en');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('auto-triggers print on load', () => {
    const html = buildPlanFileHtml(body, '', 'en');
    expect(html).toContain('window.print()');
  });

  it('omits the name line when no name is provided', () => {
    const html = buildPlanFileHtml(body, '', 'en');
    expect(html).toContain('Cultivation Plan');
    // No empty bold tag for a missing name
    expect(html).not.toContain('<b></b>');
  });
});
