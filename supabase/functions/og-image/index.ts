// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-resource',
};

// Brand tokens (match send-email + SharedDiagnosis)
const TERRA   = '#C4521A';
const GREEN   = '#194121';
const CREAM   = '#F0EDE5';
const BORDER  = '#DDD6CB';
const MUTED   = '#888077';
const TEXT    = '#3D3830';

const SEV: Record<string, { color: string; label: string }> = {
  low:    { color: '#166534', label: 'Low severity' },
  medium: { color: '#92400e', label: 'Medium severity' },
  high:   { color: '#991b1b', label: 'High severity' },
};

function x(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  return lines.slice(0, 3);
}

const OG_RATE_LIMIT  = 60;
const OG_WINDOW_HOURS = 1;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Per-IP rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (clientIp !== 'unknown') {
    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const now = new Date();
    const { data: rl } = await sbAdmin
      .from('og_image_rate_limits')
      .select('count, reset_at')
      .eq('ip', clientIp)
      .maybeSingle();

    if (rl && new Date(rl.reset_at) > now && rl.count >= OG_RATE_LIMIT) {
      return new Response('Too Many Requests', { status: 429, headers: cors });
    }

    if (!rl || new Date(rl.reset_at) <= now) {
      await sbAdmin.from('og_image_rate_limits').upsert(
        { ip: clientIp, count: 1, reset_at: new Date(now.getTime() + OG_WINDOW_HOURS * 3600_000).toISOString() },
        { onConflict: 'ip' },
      );
    } else {
      await sbAdmin.from('og_image_rate_limits').update({ count: rl.count + 1 }).eq('ip', clientIp);
    }
  }

  const url     = new URL(req.url);
  const shareId = url.searchParams.get('id');
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let data: any = null;
  if (shareId && UUID_RE.test(shareId)) {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );
    const { data: byShareId } = await sb
      .from('safe_shared_diagnoses')
      .select('crop_type,problem,diagnosis,cause,severity,product_applied,product,organic_treatments,chemical_treatments')
      .eq('share_id', shareId)
      .maybeSingle();
    data = byShareId;

    if (!data) {
      const { data: byLegacyId } = await sb
        .from('safe_shared_diagnoses')
        .select('crop_type,problem,diagnosis,cause,severity,product_applied,product,organic_treatments,chemical_treatments')
        .eq('legacy_intervention_id', shareId)
        .maybeSingle();
      data = byLegacyId;
    }
  }

  // ── Content ───────────────────────────────────────────────────────────────
  const cropRaw    = (data?.crop_type || '').toUpperCase();
  const problemRaw = data?.problem || data?.diagnosis || 'Oli Diagnosis';
  const causeRaw   = data?.cause || '';
  const sev        = data?.severity ? SEV[data.severity as string] : null;
  const organic: string[] = Array.isArray(data?.organic_treatments) ? data.organic_treatments : [];
  const chemical: string[] = Array.isArray(data?.chemical_treatments) ? data.chemical_treatments : [];

  // ── Layout constants ──────────────────────────────────────────────────────
  // 1200 × 630 — OG standard. Top 220px = terracotta header, rest = cream.
  const W = 1200, H = 630;
  const P = 60;                  // horizontal padding
  const HEADER_H = 240;          // terracotta zone height
  const BODY_TOP = HEADER_H;     // cream zone starts here

  // Header: wordmark row
  const MARK_Y = 52;

  // Crop label
  const CROP_Y = MARK_Y + 52;

  // Problem headline
  const probFontSize  = problemRaw.length > 44 ? 46 : problemRaw.length > 28 ? 54 : 62;
  const probLineH     = Math.round(probFontSize * 1.18);
  const maxChars      = Math.floor(32 + (62 - probFontSize) * 0.4);
  const probLines     = wrap(problemRaw, maxChars);
  const PROB_Y        = CROP_Y + (cropRaw ? 44 : 8);

  // Cause (if fits)
  const CAUSE_Y = PROB_Y + probLines.length * probLineH + 20;
  const causeVisible = causeRaw && CAUSE_Y < HEADER_H - 8;

  // ── Body: treatment pills ─────────────────────────────────────────────────
  const PILLS_Y = BODY_TOP + 40;
  const pills = [
    ...organic.slice(0, 2).map((t: string) => ({ label: t, color: GREEN, bg: '#dcfce7' })),
    ...chemical.slice(0, 1).map((t: string) => ({ label: t, color: '#1d4ed8', bg: '#dbeafe' })),
  ].slice(0, 3);

  const pillH = 52;
  const pillGap = 16;
  const pillW = pills.length === 0 ? 0
    : pills.length === 1 ? 600
    : pills.length === 2 ? 520
    : 360;

  const pillsHTML = pills.map((p, i) => {
    const px = P + i * (pillW + pillGap);
    const label = x(p.label.length > 42 ? p.label.slice(0, 42) + '…' : p.label);
    return `
    <rect x="${px}" y="${PILLS_Y}" width="${pillW}" height="${pillH}" rx="12"
      fill="${p.bg}" stroke="${p.color}55" stroke-width="1.5"/>
    <text x="${px + 18}" y="${PILLS_Y + 33}" fill="${p.color}"
      font-size="17" font-family="Georgia,serif" font-style="italic">${label}</text>`;
  }).join('');

  // ── OLI branding (bottom-right of cream zone) ─────────────────────────────
  const BRAND_Y = H - 56;

  // ── Severity badge (top right of header) ─────────────────────────────────
  const sevHTML = sev ? (() => {
    const bw = sev.label.length * 9 + 40;
    const bx = W - P - bw;
    const by = MARK_Y - 6;
    return `
    <rect x="${bx}" y="${by}" width="${bw}" height="32" rx="16"
      fill="rgba(255,255,255,0.18)"/>
    <text x="${bx + bw / 2}" y="${by + 21}" fill="white"
      font-size="12" font-family="-apple-system,sans-serif" text-anchor="middle"
      font-weight="600" letter-spacing="0.04em">${x(sev.label.toUpperCase())}</text>`;
  })() : '';

  // ── SVG ───────────────────────────────────────────────────────────────────
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
  xmlns="http://www.w3.org/2000/svg">

<!-- Cream background -->
<rect width="${W}" height="${H}" fill="${CREAM}"/>

<!-- Terracotta header zone -->
<rect width="${W}" height="${HEADER_H}" fill="${TERRA}"/>

<!-- Subtle texture on header: diagonal lines -->
<defs>
  <pattern id="hatch" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="24" stroke="rgba(255,255,255,0.04)" stroke-width="6"/>
  </pattern>
</defs>
<rect width="${W}" height="${HEADER_H}" fill="url(#hatch)"/>

<!-- Header / body divider -->
<line x1="0" y1="${HEADER_H}" x2="${W}" y2="${HEADER_H}"
  stroke="${BORDER}" stroke-width="1.5"/>

<!-- ── HEADER CONTENT ── -->

<!-- "· Oli" wordmark -->
<text x="${P}" y="${MARK_Y}" fill="rgba(245,239,230,0.95)"
  font-size="22" font-family="Georgia,'Times New Roman',serif"
  font-style="italic" letter-spacing="0.01em">· Oli</text>

<!-- "AI AGRONOMIST" label -->
<text x="${P + 76}" y="${MARK_Y}" fill="rgba(245,239,230,0.55)"
  font-size="11" font-family="-apple-system,Helvetica,sans-serif"
  letter-spacing="0.14em" font-weight="600">AI AGRONOMIST</text>

${sevHTML}

<!-- Crop label -->
${cropRaw ? `<text x="${P}" y="${CROP_Y}" fill="rgba(245,239,230,0.60)"
  font-size="12" font-family="-apple-system,Helvetica,sans-serif"
  letter-spacing="0.12em" font-weight="700">${x(cropRaw)}</text>` : ''}

<!-- Problem headline (italic serif) -->
${probLines.map((line, i) => `<text x="${P}" y="${PROB_Y + i * probLineH}" fill="#F5EFE6"
  font-size="${probFontSize}" font-family="Georgia,'Times New Roman',serif"
  font-style="italic" letter-spacing="-0.01em">${x(line)}</text>`).join('\n')}

<!-- Cause line -->
${causeVisible ? `<text x="${P}" y="${CAUSE_Y}" fill="rgba(245,239,230,0.62)"
  font-size="18" font-family="-apple-system,Helvetica,sans-serif" font-style="italic">
  ${x(causeRaw.length > 80 ? causeRaw.slice(0, 80) + '…' : causeRaw)}
</text>` : ''}

<!-- ── BODY CONTENT (cream zone) ── -->

<!-- Section label: TREATMENT -->
${pills.length > 0 ? `<text x="${P}" y="${PILLS_Y - 14}" fill="${MUTED}"
  font-size="11" font-family="-apple-system,Helvetica,sans-serif"
  letter-spacing="0.12em" font-weight="700">
  ${organic.length > 0 ? (chemical.length > 0 ? 'ORGANIC · CHEMICAL' : 'ORGANIC OPTIONS') : 'CHEMICAL OPTIONS'}
</text>` : ''}

<!-- Treatment pills -->
${pillsHTML}

<!-- "No treatments recorded" fallback -->
${pills.length === 0 ? `<text x="${P}" y="${PILLS_Y + 32}" fill="${MUTED}"
  font-size="18" font-family="Georgia,serif" font-style="italic">
  Diagnosis shared by Oli · AI Agronomist
</text>` : ''}

<!-- Brand footer -->
<text x="${P}" y="${BRAND_Y}" fill="${MUTED}"
  font-size="15" font-family="Georgia,'Times New Roman',serif"
  font-style="italic">ask-oli.com</text>

<!-- "Free 20 questions" tagline -->
<text x="${P}" y="${BRAND_Y + 22}" fill="${MUTED}"
  font-size="12" font-family="-apple-system,Helvetica,sans-serif"
  letter-spacing="0.04em">Free for the first 20 questions</text>

<!-- CTA pill (right side) -->
<rect x="${W - P - 260}" y="${BRAND_Y - 18}" width="260" height="46" rx="23"
  fill="${GREEN}"/>
<text x="${W - P - 130}" y="${BRAND_Y + 12}" fill="white"
  font-size="15" font-family="-apple-system,Helvetica,sans-serif"
  font-weight="700" text-anchor="middle" letter-spacing="0.01em">
  Try Oli free →
</text>

</svg>`;

  return new Response(svg, {
    headers: {
      ...cors,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
