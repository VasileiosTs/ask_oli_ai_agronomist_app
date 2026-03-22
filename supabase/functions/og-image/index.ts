// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEV: Record<string, { color: string; label: string }> = {
  low:    { color: '#2EA043', label: 'Χαμηλή σοβαρότητα' },
  medium: { color: '#D97706', label: 'Μέτρια σοβαρότητα' },
  high:   { color: '#DC2626', label: 'Υψηλή σοβαρότητα' },
};

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Wrap text into lines of max `max` characters
function wrap(text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > max && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const shareId = url.searchParams.get('id');

  let data: any = null;
  if (shareId) {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );
    const { data: d } = await sb
      .from('safe_shared_diagnoses')
      .select('crop_type,problem,diagnosis,cause,severity,product_applied,product,organic_treatments,chemical_treatments')
      .eq('share_id', shareId)
      .maybeSingle();
    data = d;
  }

  // Content
  const crop    = esc((data?.crop_type || 'Καλλιέργεια').toUpperCase());
  const problem = esc(data?.problem || data?.diagnosis || 'Διάγνωση από Oli');
  const cause   = esc(data?.cause || '');
  const sev     = data?.severity ? SEV[data.severity as string] : null;
  const organic: string[] = Array.isArray(data?.organic_treatments) ? data.organic_treatments.slice(0, 2) : [];
  const chemical: string[] = Array.isArray(data?.chemical_treatments) ? data.chemical_treatments.slice(0, 1) : [];

  // Layout constants
  const W = 1200, H = 630;
  const PAD = 64;

  // Problem headline — wrap at ~28 chars, font size based on length
  const fontSize = problem.length > 35 ? 52 : problem.length > 22 ? 62 : 72;
  const lineH = fontSize + 10;
  const lines = wrap(problem, Math.floor(26 + (72 - fontSize) * 0.4));

  // Y positions
  const headerY = 68;
  const cropY = 148;
  const probY = 188;
  const causeY = probY + lines.length * lineH + 20;
  const pillsY = cause ? causeY + 44 : probY + lines.length * lineH + 36;

  // Pills
  const allPills = [
    ...organic.map(t  => ({ text: `🌿 ${esc(t)}`,  color: '#2EA043', border: '#2EA04340' })),
    ...chemical.map(t => ({ text: `⚗️ ${esc(t)}`, color: '#60A5FA', border: '#60A5FA40' })),
  ];
  const pillsSvg = allPills.slice(0, 3).map((p, i) => {
    const x = PAD + i * 340;
    const label = p.text.length > 36 ? p.text.slice(0, 36) + '…' : p.text;
    return `<rect x="${x}" y="${pillsY}" width="320" height="48" rx="10"
      fill="${p.color}12" stroke="${p.border}" stroke-width="1.5"/>
    <text x="${x + 16}" y="${pillsY + 31}" fill="${p.color}"
      font-size="15" font-family="system-ui,sans-serif">${label}</text>`;
  }).join('');

  // Severity badge
  const sevBadge = sev ? (() => {
    const bw = sev.label.length * 9 + 32;
    const bx = W - PAD - bw;
    return `<rect x="${bx}" y="${headerY - 20}" width="${bw}" height="34" rx="17"
        fill="${sev.color}15" stroke="${sev.color}50" stroke-width="1.5"/>
      <text x="${bx + bw/2}" y="${headerY - 2}" fill="${sev.color}"
        font-size="13" font-family="system-ui,sans-serif" text-anchor="middle">${sev.label}</text>`;
  })() : '';

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="25%" r="70%">
      <stop offset="0%" stop-color="#0d1a12"/>
      <stop offset="100%" stop-color="#080C10"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="60%">
      <stop offset="0%" stop-color="#2EA043" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#2EA043" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#2EA043" stop-opacity="0"/>
      <stop offset="50%"  stop-color="#2EA043" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#2EA043" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- BG -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Left accent bar -->
  <rect x="0" y="0" width="3" height="${H}" fill="url(#bar)"/>

  <!-- Subtle horizontal rules -->
  <line x1="${PAD}" y1="116" x2="${W - PAD}" y2="116" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
  <line x1="${PAD}" y1="${H - 76}" x2="${W - PAD}" y2="${H - 76}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

  <!-- Logo -->
  <svg x="${PAD}" y="${headerY - 20}" width="28" height="28" viewBox="0 0 32 32">
    <ellipse cx="16" cy="7"  rx="7" ry="10" fill="#2D6A4F"/>
    <ellipse cx="16" cy="25" rx="7" ry="10" fill="#2D6A4F"/>
    <ellipse cx="7"  cy="16" rx="10" ry="7" fill="#2EA043"/>
    <ellipse cx="25" cy="16" rx="10" ry="7" fill="#2EA043"/>
    <circle  cx="16" cy="16" r="5"  fill="#080C10"/>
  </svg>
  <text x="${PAD + 40}" y="${headerY - 2}" fill="#2EA043"
    font-size="13" font-family="system-ui,sans-serif" letter-spacing="3" font-weight="500">OLI · AI ΓΕΩΠΟΝΟΣ</text>

  ${sevBadge}

  <!-- Crop label -->
  <text x="${PAD}" y="${cropY}" fill="#2EA043"
    font-size="12" font-family="system-ui,sans-serif" letter-spacing="5" font-weight="600">${crop}</text>

  <!-- Problem headline -->
  ${lines.map((line, i) => `
  <text x="${PAD}" y="${probY + i * lineH}" fill="#FFFFFF"
    font-size="${fontSize}" font-family="system-ui,sans-serif"
    font-weight="700" letter-spacing="-1">${esc(line)}</text>`).join('')}

  <!-- Cause -->
  ${cause ? `<text x="${PAD}" y="${causeY}" fill="rgba(232,237,242,0.45)"
    font-size="19" font-family="system-ui,sans-serif">${cause.length > 72 ? cause.slice(0, 72) + '…' : cause}</text>` : ''}

  <!-- Treatment pills -->
  ${pillsSvg}

  <!-- Footer: url -->
  <text x="${PAD}" y="${H - 28}" fill="rgba(232,237,242,0.2)"
    font-size="13" font-family="system-ui,sans-serif">askoli.app · Oli AI Γεωπόνος</text>

  <!-- Footer: CTA -->
  <rect x="${W - PAD - 200}" y="${H - 58}" width="200" height="40" rx="20" fill="#2EA043"/>
  <text x="${W - PAD - 100}" y="${H - 32}" fill="white" font-size="14" font-weight="600"
    font-family="system-ui,sans-serif" text-anchor="middle">Δες τη διάγνωση →</text>
</svg>`;

  return new Response(svg, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
