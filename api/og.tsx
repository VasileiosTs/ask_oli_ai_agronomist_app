import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const TERRA  = '#C4521A';
const GREEN  = '#194121';
const CREAM  = '#F0EDE5';
const BORDER = '#DDD6CB';
const MUTED  = '#888077';

type Lang = 'el' | 'ar' | 'en';

const T: Record<Lang, {
  agronomist: string;
  organicOnly: string;
  chemicalOnly: string;
  both: string;
  fallback: string;
  cta: string;
  sevLow: string;
  sevMedium: string;
  sevHigh: string;
}> = {
  el: {
    agronomist: 'AI ΓΕΩΠΟΝΟΣ',
    organicOnly: 'ΒΙΟΛΟΓΙΚΕΣ ΕΠΙΛΟΓΕΣ',
    chemicalOnly: 'ΧΗΜΙΚΕΣ ΕΠΙΛΟΓΕΣ',
    both: 'ΒΙΟΛΟΓΙΚΑ · ΧΗΜΙΚΑ',
    fallback: 'Διάγνωση από τον Oli · AI Γεωπόνο',
    cta: 'Δοκίμασε Oli - AI Γεωπόνο ΔΩΡΕΑΝ',
    sevLow: 'Χαμηλή σοβαρότητα',
    sevMedium: 'Μέτρια σοβαρότητα',
    sevHigh: 'Υψηλή σοβαρότητα',
  },
  ar: {
    agronomist: 'مهندس زراعي AI',
    organicOnly: 'خيارات عضوية',
    chemicalOnly: 'خيارات كيميائية',
    both: 'عضوي · كيميائي',
    fallback: 'تشخيص من Oli · مهندس زراعي AI',
    cta: 'جرّب Oli - تطبيق المهندس الزراعي مجاناً',
    sevLow: 'خطورة منخفضة',
    sevMedium: 'خطورة متوسطة',
    sevHigh: 'خطورة عالية',
  },
  en: {
    agronomist: 'AI AGRONOMIST',
    organicOnly: 'ORGANIC OPTIONS',
    chemicalOnly: 'CHEMICAL OPTIONS',
    both: 'ORGANIC · CHEMICAL',
    fallback: 'Diagnosis shared by Oli · AI Agronomist',
    cta: 'Try Oli - AI Agronomist App FREE',
    sevLow: 'Low severity',
    sevMedium: 'Medium severity',
    sevHigh: 'High severity',
  },
};

function detectLang(text: string): Lang {
  if (/[Ͱ-Ͽἀ-῿]/.test(text)) return 'el';
  if (/[؀-ۿ]/.test(text)) return 'ar';
  return 'en';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const shareId = url.searchParams.get('id') ?? '';

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';

  let cropRaw = '';
  let problemRaw = '';
  let causeRaw = '';
  let severity: string | null = null;
  let organic: string[] = [];
  let chemical: string[] = [];

  if (UUID_RE.test(shareId) && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/safe_shared_diagnoses` +
          `?share_id=eq.${encodeURIComponent(shareId)}` +
          `&select=crop_type,problem,diagnosis,cause,severity,organic_treatments,chemical_treatments&limit=1`,
        {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
          signal: AbortSignal.timeout(3000),
        },
      );
      if (res.ok) {
        const rows = await res.json() as Record<string, unknown>[];
        const row = rows?.[0];
        if (row) {
          cropRaw    = (row.crop_type as string) ?? '';
          problemRaw = (row.problem as string) || (row.diagnosis as string) || '';
          causeRaw   = (row.cause as string) ?? '';
          severity   = (row.severity as string) ?? null;
          organic    = Array.isArray(row.organic_treatments) ? row.organic_treatments as string[] : [];
          chemical   = Array.isArray(row.chemical_treatments) ? row.chemical_treatments as string[] : [];
        }
      }
    } catch {
      // fall through to defaults
    }
  }

  const lang = detectLang(problemRaw || causeRaw || cropRaw);
  const t = T[lang];

  const crop = cropRaw.toUpperCase();
  const displayProblem = problemRaw || 'Oli Diagnosis';

  const sevLabel = severity === 'low' ? t.sevLow : severity === 'medium' ? t.sevMedium : severity === 'high' ? t.sevHigh : null;

  const pills = [
    ...organic.slice(0, 2).map((tx: string) => ({ label: tx, color: GREEN, bg: '#dcfce7' })),
    ...chemical.slice(0, 1).map((tx: string) => ({ label: tx, color: '#1d4ed8', bg: '#dbeafe' })),
  ].slice(0, 3);

  const probFontSize = displayProblem.length > 44 ? 46 : displayProblem.length > 28 ? 54 : 62;

  const treatmentLabel =
    organic.length > 0
      ? chemical.length > 0 ? t.both : t.organicOnly
      : t.chemicalOnly;

  const isArabic = lang === 'ar';

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: CREAM,
          fontFamily: 'Georgia, serif',
          direction: isArabic ? 'rtl' : 'ltr',
        }}
      >
        {/* Terracotta header */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: TERRA,
            width: 1200,
            height: 240,
            padding: '52px 60px 24px',
            position: 'relative',
          }}
        >
          {/* Wordmark row */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
            <span style={{ color: 'rgba(245,239,230,0.95)', fontSize: 22, fontStyle: 'italic' }}>
              · Oli
            </span>
            <span
              style={{
                color: 'rgba(245,239,230,0.55)',
                fontSize: 11,
                fontFamily: 'Helvetica, sans-serif',
                letterSpacing: '0.14em',
                fontWeight: 600,
              }}
            >
              {t.agronomist}
            </span>
          </div>

          {/* Crop label */}
          {crop ? (
            <span
              style={{
                color: 'rgba(245,239,230,0.60)',
                fontSize: 12,
                fontFamily: 'Helvetica, sans-serif',
                letterSpacing: '0.12em',
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              {crop}
            </span>
          ) : null}

          {/* Problem headline */}
          <span
            style={{
              color: '#F5EFE6',
              fontSize: probFontSize,
              fontStyle: 'italic',
              letterSpacing: '-0.01em',
              lineHeight: 1.18,
              maxWidth: 900,
            }}
          >
            {displayProblem.length > 80 ? displayProblem.slice(0, 80) + '…' : displayProblem}
          </span>

          {/* Cause */}
          {causeRaw ? (
            <span
              style={{
                color: 'rgba(245,239,230,0.62)',
                fontSize: 18,
                fontStyle: 'italic',
                fontFamily: 'Helvetica, sans-serif',
                marginTop: 8,
              }}
            >
              {causeRaw.length > 80 ? causeRaw.slice(0, 80) + '…' : causeRaw}
            </span>
          ) : null}

          {/* Severity badge */}
          {sevLabel ? (
            <div
              style={{
                position: 'absolute',
                top: 46,
                right: 60,
                backgroundColor: 'rgba(255,255,255,0.18)',
                borderRadius: 16,
                padding: '6px 16px',
                display: 'flex',
              }}
            >
              <span
                style={{
                  color: 'white',
                  fontSize: 12,
                  fontFamily: 'Helvetica, sans-serif',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                {sevLabel.toUpperCase()}
              </span>
            </div>
          ) : null}
        </div>

        {/* Divider */}
        <div style={{ width: 1200, height: 1.5, backgroundColor: BORDER }} />

        {/* Cream body */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            padding: '40px 60px 32px',
          }}
        >
          {/* Treatment section label */}
          {pills.length > 0 ? (
            <span
              style={{
                color: MUTED,
                fontSize: 11,
                fontFamily: 'Helvetica, sans-serif',
                letterSpacing: '0.12em',
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              {treatmentLabel}
            </span>
          ) : (
            <span style={{ color: MUTED, fontSize: 18, fontStyle: 'italic', marginBottom: 14 }}>
              {t.fallback}
            </span>
          )}

          {/* Treatment pills */}
          <div style={{ display: 'flex', gap: 16 }}>
            {pills.map((p, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: p.bg,
                  border: `1.5px solid ${p.color}55`,
                  borderRadius: 12,
                  padding: '12px 18px',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  maxWidth: pills.length === 1 ? 600 : pills.length === 2 ? 520 : 360,
                }}
              >
                <span style={{ color: p.color, fontSize: 17, fontStyle: 'italic' }}>
                  {p.label.length > 42 ? p.label.slice(0, 42) + '…' : p.label}
                </span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginTop: 'auto',
            }}
          >
            <span style={{ color: MUTED, fontSize: 15, fontStyle: 'italic' }}>ask-oli.com</span>
            <div
              style={{
                backgroundColor: GREEN,
                borderRadius: 23,
                padding: '12px 32px',
                display: 'flex',
              }}
            >
              <span
                style={{
                  color: 'white',
                  fontSize: 14,
                  fontFamily: 'Helvetica, sans-serif',
                  fontWeight: 700,
                  letterSpacing: '0.01em',
                }}
              >
                {t.cta}
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    },
  );
}
