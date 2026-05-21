/**
 * Vercel Edge Middleware — runs before rewrites, at the CDN edge.
 *
 * Purpose: social crawlers never execute JavaScript, so the dynamic OG tags
 * set in SharedDiagnosis.tsx are invisible to them. For any /d/:shareId
 * request from a known bot UA, this middleware fetches the diagnosis from
 * Supabase REST API and returns a minimal HTML page with correct Open Graph,
 * Twitter Card, and LinkedIn article tags. Real users receive `undefined` so
 * Vercel continues to the normal SPA rewrite (index.html).
 */

export const config = {
  matcher: ['/d/:path*'],
};

const BOT_UA =
  /WhatsApp|facebookexternalhit|Facebot|LinkedInBot|Twitterbot|Slackbot|Googlebot|bingbot|YandexBot|Applebot|redditbot|Line\/|Viber|TelegramBot|Discordbot|DuckDuckBot|AhrefsBot|SemrushBot/i;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function middleware(request: Request): Promise<Response | void> {
  const ua = request.headers.get('user-agent') ?? '';
  if (!BOT_UA.test(ua)) return; // real user — let Vercel serve index.html via rewrite

  const url = new URL(request.url);
  const shareId = url.pathname.split('/d/')[1]?.split('/')[0]?.split('?')[0] ?? '';
  if (!UUID_RE.test(shareId)) return;

  const SUPABASE_URL =
    process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const SUPABASE_ANON_KEY =
    process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
  const APP_URL = 'https://www.ask-oli.com';

  let problem = '';
  let crop = '';
  let summary = '';

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const apiResp = await fetch(
        `${SUPABASE_URL}/rest/v1/safe_shared_diagnoses` +
          `?share_id=eq.${encodeURIComponent(shareId)}` +
          `&select=problem,diagnosis,crop_type,share_summary&limit=1`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          signal: AbortSignal.timeout(3000),
        },
      );
      if (apiResp.ok) {
        const rows = (await apiResp.json()) as Record<string, string>[];
        const row = rows?.[0];
        problem = row?.problem || row?.diagnosis || '';
        crop = row?.crop_type || '';
        summary = row?.share_summary || '';
      }
    } catch {
      // fall through to generic tags — better a generic card than no card
    }
  }

  const title =
    problem && crop
      ? `${problem} — ${crop} | Oli`
      : problem
        ? `${problem} | Oli`
        : 'Crop Disease Diagnosis | Oli — AI Agronomist';

  const description =
    summary
      ? `${summary} — Diagnosed with Oli, AI agronomist for farmers.`
      : problem
        ? `${problem}. AI-powered crop disease diagnosis with organic and chemical treatments.`
        : 'AI crop disease diagnosis for small farmers. Organic and chemical treatments with exact dosages, 24/7.';

  const ogUrl = `${APP_URL}/d/${shareId}`;
  // Dynamic OG image via Vercel Edge API route (returns 1200×630 PNG)
  const ogImage = `${APP_URL}/api/og?id=${shareId}`;

  const html = `<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(ogUrl)}">

<!-- Open Graph — WhatsApp, Viber, Facebook, LinkedIn, Telegram, Line, Reddit -->
<meta property="og:type" content="article">
<meta property="og:site_name" content="Oli — AI Agronomist">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(ogUrl)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="og:locale" content="el_GR">
<meta property="og:locale:alternate" content="en_US">

<!-- Twitter / X -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<meta name="twitter:image:alt" content="${esc(title)}">

<!-- LinkedIn article tags -->
<meta property="article:author" content="Oli — AI Agronomist">
<meta property="article:publisher" content="${esc(APP_URL)}">

<!-- Redirect real browsers (e.g. Googlebot rendering) to the SPA -->
<meta http-equiv="refresh" content="0;url=${esc(ogUrl)}">
<script>window.location.replace(${JSON.stringify(ogUrl)});</script>
</head>
<body><p>Loading... <a href="${esc(ogUrl)}">Click here if not redirected.</a></p></body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Cache at CDN for 5 min; stale-while-revalidate for 24h so bots get fast responses
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
      'Vary': 'User-Agent',
    },
  });
}
