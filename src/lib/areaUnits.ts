export type AreaUnit = 'ha' | 'stremma' | 'acre';

/** How many display units equal 1 ha stored in the DB */
const TO_DISPLAY: Record<AreaUnit, number> = {
  ha:      1,
  stremma: 10,      // 1 ha = 10 stremma
  acre:    2.47105, // 1 ha = 2.47105 acres
};

/** Convert ha (DB value) → display unit */
export function haToDisplay(ha: number, unit: AreaUnit): number {
  const v = ha * TO_DISPLAY[unit];
  return Math.round(v * 100) / 100;
}

/** Convert display unit value → ha (for DB storage) */
export function displayToHa(value: number, unit: AreaUnit): number {
  return value / TO_DISPLAY[unit];
}

/** Format area for display: "5 ha" / "50 στρ." / "12.36 ac" */
export function formatArea(ha: number | null, unit: AreaUnit, lang = 'en'): string {
  if (ha === null || ha === undefined) return '';
  const val = haToDisplay(ha, unit);
  const label = unitLabel(unit, lang);
  return `${val} ${label}`;
}

/** Short unit label */
export function unitLabel(unit: AreaUnit, lang = 'en'): string {
  if (unit === 'stremma') return lang === 'el' ? 'στρ.' : 'stremma';
  if (unit === 'acre')    return 'ac';
  return 'ha';
}

/** Detect a sensible default unit from the user's app language */
export function defaultUnitForLang(lang: string): AreaUnit {
  if (lang === 'el') return 'stremma';
  return 'ha';
}
