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

/** Countries that measure land in stremma (0.1 ha): Greece, Cyprus */
const STREMMA_TIMEZONES = new Set(['Europe/Athens', 'Asia/Nicosia']);

/** US timezones where land is measured in acres (Canada is metric → ha) */
const ACRE_TIMEZONES = new Set([
  'America/New_York', 'America/Detroit', 'America/Chicago', 'America/Denver',
  'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'America/Boise',
  'America/Indiana/Indianapolis', 'America/Kentucky/Louisville', 'Pacific/Honolulu',
]);

/**
 * Detect a sensible default unit from the user's locale, preferring the country
 * signal (timezone, then navigator region) over UI language. This is why a Greek
 * grower running an English-language phone still defaults to stremma, and a US
 * grower defaults to acre. Falls back to the language-based default, then ha.
 * Browser-only (Intl/navigator); pass `lang` so server-rendered/no-DOM paths still resolve.
 */
export function defaultUnitForLocale(lang?: string): AreaUnit {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && STREMMA_TIMEZONES.has(tz)) return 'stremma';
    if (tz && ACRE_TIMEZONES.has(tz)) return 'acre';
  } catch { /* ignore */ }
  const nav = typeof navigator !== 'undefined' ? (navigator.language?.toLowerCase() ?? '') : '';
  if (nav.startsWith('el')) return 'stremma';
  if (nav.startsWith('en-us')) return 'acre';
  return defaultUnitForLang(lang ?? '');
}
