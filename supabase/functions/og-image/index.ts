// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEV_COLOR: Record<string, string> = {
  low: '#2EA043', medium: '#D97706', high: '#DC2626',
};
const SEV_LABEL: Record<string, string> = {
  low: 'Χαμηλή σοβαρότητα', medium: 'Μέτρια σοβαρότητα', high: 'Υψηλή σοβαρότητα',
};

function escapeXml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const shareId = url.searchParams.get('id') || url.pathname.split('/').pop();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  );

  let data: any = null;
  if (shareId && shareId !== 'og-image') {
    const { data: d } = await supabase
      .from('safe_shared_diagnoses')
      .select('*')
      .eq('share_id', shareId)
      .maybeSingle();
    data = d;
  }

  const crop = escapeXml(data?.crop_type || 'Καλλιέργεια');
  const problem = escapeXml(data?.problem || data?.diagnosis || 'Διάγνωση από Oli');
  const cause = escapeXml(data?.cause || '');
  const organic: string[] = Array.isArray(data?.organic_treatments) ? data.organic_treatments.slice(0, 2) : [];
  const chemical: string[] = Array.isArray(data?.chemical_treatments) ? data.chemical_treatments.slice(0, 1) : [];
  const sev = data?.severity as string | null;
  const sevColor = sev ? (SEV_COLOR[sev] || '#2EA043') : '#2EA043';
  const sevLabel = sev ? SEV_LABEL[sev] : '';

  // Font size based on problem length
  const probFontSize = problem.length > 45 ? 48 : problem.length > 30 ? 56 : 66;
  const probLines = wrapText(problem, Math.floor(800 / (probFontSize * 0.55)));

  // Build treatment pills
  const pills: Array<{text: string, color: string, bg: string, border: string}> = [
    ...organic.map(t => ({ text: `🌿 ${escapeXml(t)}`, color: '#2EA043', bg: 'rgba(46,160,67,0.1)', border: 'rgba(46,160,67,0.3)' })),
    ...chemical.map(t => ({ text: `⚗️ ${escapeXml(t)}`, color: '#60A5FA', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.25)' })),
  ];

  const pillsY = 420;
  const pillsSvg = pills.map((p, i) => {
    const x = 60 + i * 340;
    const truncated = p.text.length > 38 ? p.text.slice(0, 38) + '…' : p.text;
    return `
      <rect x="${x}" y="${pillsY}" width="320" height="52" rx="12"
        fill="${p.bg}" stroke="${p.border}" stroke-width="1"/>
      <text x="${x + 16}" y="${pillsY + 33}" fill="${p.color}"
        font-size="15" font-family="system-ui,sans-serif">${truncated}</text>`;
  }).join('');

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#0f1a14"/>
      <stop offset="100%" stop-color="#080C10"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="70%">
      <stop offset="0%" stop-color="#2EA043" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#2EA043" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Left accent bar -->
  <rect x="0" y="0" width="4" height="630" fill="url(#bar)"/>
  <defs>
    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2EA043" stop-opacity="0"/>
      <stop offset="50%" stop-color="#2EA043" stop-opacity="1"/>
      <stop offset="100%" stop-color="#2EA043" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Grid texture lines (subtle) -->
  ${Array.from({length:8},(_,i)=>`<line x1="0" y1="${i*90}" x2="1200" y2="${i*90}" stroke="rgba(255,255,255,0.02)" stroke-width="1"/>`).join('')}

  <!-- Header: Logo + brand -->
  <svg x="56" y="52" width="32" height="32" viewBox="0 0 32 32">
    <ellipse cx="16" cy="7"  rx="7" ry="10" fill="#2D6A4F"/>
    <ellipse cx="16" cy="25" rx="7" ry="10" fill="#2D6A4F"/>
    <ellipse cx="7"  cy="16" rx="10" ry="7" fill="#2EA043"/>
    <ellipse cx="25" cy="16" rx="10" ry="7" fill="#2EA043"/>
    <circle  cx="16" cy="16" r="5"  fill="#080C10"/>
  </svg>
  <text x="98" y="74" fill="#2EA043" font-size="15"
    font-family="system-ui,sans-serif" letter-spacing="3" font-weight="500">OLI · AI ΓΕΩΠΟΝΟΣ</text>

  ${sevLabel ? `
  <!-- Severity badge -->
  <rect x="${1200 - 60 - (sevLabel.length * 9 + 32)}" y="48" width="${sevLabel.length * 9 + 32}" height="36" rx="18"
    fill="${sevColor}18" stroke="${sevColor}50" stroke-width="1"/>
  <text x="${1200 - 44 - (sevLabel.length * 9 / 2)}" y="71" fill="${sevColor}" font-size="13"
    font-family="system-ui,sans-serif" text-anchor="middle">${sevLabel}</text>
  ` : ''}

  <!-- Crop label -->
  <text x="60" y="155" fill="#2EA043" font-size="14"
    font-family="system-ui,sans-serif" letter-spacing="4" font-weight="500">${crop.toUpperCase()}</text>

  <!-- Problem headline -->
  ${probLines.map((line, i) => `
  <text x="60" y="${195 + i * (probFontSize + 8)}" fill="#FFFFFF" font-size="${probFontSize}"
    font-family="system-ui,sans-serif" font-weight="700" letter-spacing="-1">${line}</text>`).join('')}

  ${cause ? `
  <!-- Cause -->
  <text x="60" y="${195 + probLines.length * (probFontSize + 8) + 20}"
    fill="rgba(232,237,242,0.45)" font-size="20"
    font-family="system-ui,sans-serif">Αιτία: ${cause.length > 70 ? cause.slice(0,70)+'…' : cause}</text>
  ` : ''}

  <!-- Treatment pills -->
  ${pillsSvg}

  <!-- Footer divider -->
  <line x1="60" y1="548" x2="1140" y2="548" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>

  <!-- Footer left: url -->
  <text x="60" y="582" fill="rgba(232,237,242,0.25)" font-size="14"
    font-family="system-ui,sans-serif">Από τον Oli · AI Γεωπόνος · askoli.app</text>

  <!-- Footer right: CTA button -->
  <rect x="960" y="558" width="180" height="40" rx="20" fill="#2EA043"/>
  <text x="1050" y="583" fill="white" font-size="13" font-weight="600"
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
