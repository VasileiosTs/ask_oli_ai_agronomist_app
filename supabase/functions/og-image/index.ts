// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEV: Record<string, { color: string; label: string }> = {
  low:    { color: '#2EA043', label: 'Χαμηλή σοβαρότητα' },
  medium: { color: '#D97706', label: 'Μέτρια σοβαρότητα' },
  high:   { color: '#DC2626', label: 'Υψηλή σοβαρότητα' },
};

function x(s: string): string {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function wrap(text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (t.length > max && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3); // hard cap at 3 lines to prevent overflow
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = new URL(req.url);
  const shareId = url.searchParams.get('id');

  let data: any = null;
  if (shareId) {
    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const { data: d } = await sb
      .from('safe_shared_diagnoses')
      .select('crop_type,problem,diagnosis,cause,severity,product_applied,product,organic_treatments,chemical_treatments')
      .eq('share_id', shareId)
      .maybeSingle();
    data = d;
  }

  // ── Content ──────────────────────────────────────────────────────────────
  const crop    = x((data?.crop_type || 'Καλλιέργεια').toUpperCase());
  const problem = x(data?.problem || data?.diagnosis || 'Διάγνωση από Oli');
  const cause   = x(data?.cause || '');
  const sev     = data?.severity ? SEV[data.severity as string] : null;
  const product = x(data?.product_applied || data?.product || '');
  const organic: string[] = Array.isArray(data?.organic_treatments) ? data.organic_treatments : [];
  const chemical: string[] = Array.isArray(data?.chemical_treatments) ? data.chemical_treatments : [];

  // ── Layout ────────────────────────────────────────────────────────────────
  // Fixed 1200×630 — the OG standard. All Y positions calculated top-down
  // with explicit bounds so nothing can overflow.
  const W = 1200, H = 630, P = 64;

  // Zones (all measured from top):
  const HEADER_TOP = 48;   // logo + brand
  const RULE1      = 112;  // horizontal divider after header
  const CONTENT_TOP = 136; // crop label starts here
  const FOOTER_TOP  = H - 80; // footer zone starts here
  const CONTENT_H   = FOOTER_TOP - CONTENT_TOP; // 414px available for content

  // Problem headline sizing — font size chosen so 3 lines fit in ~180px
  const probFontSize = problem.length > 40 ? 48 : problem.length > 24 ? 58 : 68;
  const probLineH = Math.round(probFontSize * 1.15);
  const maxCharsPerLine = Math.floor(30 + (68 - probFontSize) * 0.5);
  const probLines = wrap(problem, maxCharsPerLine);
  const probBlockH = probLines.length * probLineH;

  // After problem: cause (optional), then pills
  const PROB_Y  = CONTENT_TOP + 28; // first line baseline
  const CAUSE_Y = PROB_Y + probBlockH + 28;
  const PILLS_Y = cause ? CAUSE_Y + 36 : PROB_Y + probBlockH + 32;

  // Ensure pills don't go below footer — clamp
  const PILLS_SAFE_Y = Math.min(PILLS_Y, FOOTER_TOP - 68);

  // Treatment pills — max 3, prefer organic first
  const pills = [
    ...organic.slice(0, 2).map(t => ({ t: `🌿 ${x(t)}`, c: '#2EA043' })),
    ...chemical.slice(0, 1).map(t => ({ t: `⚗️ ${x(t)}`, c: '#60A5FA' })),
    // fallback if no treatments: show product
    ...(organic.length === 0 && chemical.length === 0 && product ? [{ t: product, c: '#2EA043' }] : []),
  ].slice(0, 3);

  const pillW = pills.length === 1 ? 500 : pills.length === 2 ? 450 : 340;
  const pillsHTML = pills.map((p, i) => {
    const px = P + i * (pillW + 16);
    const label = p.t.length > 38 ? p.t.slice(0, 38) + '…' : p.t;
    return `
    <rect x="${px}" y="${PILLS_SAFE_Y}" width="${pillW}" height="52" rx="10"
      fill="${p.c}10" stroke="${p.c}40" stroke-width="1.5"/>
    <text x="${px + 18}" y="${PILLS_SAFE_Y + 34}" fill="${p.c}"
      font-size="16" font-family="system-ui,sans-serif">${label}</text>`;
  }).join('');

  // Severity badge (top right)
  const sevHTML = sev ? (() => {
    const bw = Math.max(sev.label.length * 9 + 36, 140);
    const bx = W - P - bw;
    const by = HEADER_TOP;
    return `
    <rect x="${bx}" y="${by}" width="${bw}" height="34" rx="17"
      fill="${sev.color}18" stroke="${sev.color}55" stroke-width="1.5"/>
    <text x="${bx + bw / 2}" y="${by + 22}" fill="${sev.color}"
      font-size="13" font-family="system-ui,sans-serif" text-anchor="middle"
      font-weight="500">${sev.label}</text>`;
  })() : '';

  // CTA button — "Δοκίμασε δωρεάν" — links to app
  const CTAbtnW = 220;
  const CTAbtnX = W - P - CTAbtnW;
  const CTAbtnY = FOOTER_TOP + 18;

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<defs>
  <radialGradient id="bg" cx="50%" cy="20%" r="75%">
    <stop offset="0%" stop-color="#0d1a12"/>
    <stop offset="100%" stop-color="#080C10"/>
  </radialGradient>
  <radialGradient id="glow" cx="50%" cy="0%" r="55%">
    <stop offset="0%" stop-color="#2EA043" stop-opacity="0.11"/>
    <stop offset="100%" stop-color="#2EA043" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#2EA043" stop-opacity="0"/>
    <stop offset="40%"  stop-color="#2EA043" stop-opacity="1"/>
    <stop offset="100%" stop-color="#2EA043" stop-opacity="0.2"/>
  </linearGradient>
</defs>

<!-- Background -->
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>

<!-- Left accent bar -->
<rect x="0" y="0" width="4" height="${H}" fill="url(#bar)"/>

<!-- Header divider -->
<line x1="${P}" y1="${RULE1}" x2="${W - P}" y2="${RULE1}"
  stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

<!-- Footer divider -->
<line x1="${P}" y1="${FOOTER_TOP}" x2="${W - P}" y2="${FOOTER_TOP}"
  stroke="rgba(255,255,255,0.07)" stroke-width="1"/>

<!-- Logo -->
<svg x="${P}" y="${HEADER_TOP}" width="30" height="30" viewBox="0 0 32 32">
  <ellipse cx="16" cy="7"  rx="7" ry="10" fill="#2D6A4F"/>
  <ellipse cx="16" cy="25" rx="7" ry="10" fill="#2D6A4F"/>
  <ellipse cx="7"  cy="16" rx="10" ry="7" fill="#2EA043"/>
  <ellipse cx="25" cy="16" rx="10" ry="7" fill="#2EA043"/>
  <circle  cx="16" cy="16" r="5"  fill="#080C10"/>
</svg>
<text x="${P + 42}" y="${HEADER_TOP + 20}" fill="#2EA043"
  font-size="13" font-family="system-ui,sans-serif"
  letter-spacing="3" font-weight="600">OLI · AI ΓΕΩΠΟΝΟΣ</text>

${sevHTML}

<!-- Crop label -->
<text x="${P}" y="${CONTENT_TOP + 20}" fill="#2EA043"
  font-size="12" font-family="system-ui,sans-serif"
  letter-spacing="6" font-weight="700">${crop}</text>

<!-- Problem headline -->
${probLines.map((line, i) => `<text x="${P}" y="${PROB_Y + i * probLineH}" fill="#FFFFFF"
  font-size="${probFontSize}" font-family="system-ui,sans-serif"
  font-weight="700" letter-spacing="-1">${x(line)}</text>`).join('\n')}

<!-- Cause -->
${cause ? `<text x="${P}" y="${CAUSE_Y}" fill="rgba(232,237,242,0.42)"
  font-size="18" font-family="system-ui,sans-serif">${cause.length > 75 ? cause.slice(0,75) + '…' : cause}</text>` : ''}

<!-- Treatment pills -->
${pillsHTML}

<!-- Footer left: brand -->
<text x="${P}" y="${FOOTER_TOP + 28}" fill="rgba(232,237,242,0.22)"
  font-size="13" font-family="system-ui,sans-serif">askoli.app</text>

<text x="${P}" y="${FOOTER_TOP + 46}" fill="rgba(232,237,242,0.14)"
  font-size="12" font-family="system-ui,sans-serif">Δωρεάν για τις πρώτες 20 ερωτήσεις</text>

<!-- CTA button: Δοκίμασε δωρεάν -->
<rect x="${CTAbtnX}" y="${CTAbtnY}" width="${CTAbtnW}" height="44" rx="22" fill="#2EA043"/>
<text x="${CTAbtnX + CTAbtnW / 2}" y="${CTAbtnY + 28}" fill="white"
  font-size="15" font-weight="700" font-family="system-ui,sans-serif"
  text-anchor="middle">Δοκίμασε δωρεάν →</text>

</svg>`;

  return new Response(svg, {
    headers: {
      ...cors,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
