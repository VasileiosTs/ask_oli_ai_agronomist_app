/**
 * Removes <link rel="modulepreload"> tags for chunks that should be lazy.
 *
 * react-snap prerenders the page with real Chrome. During prerendering,
 * requestAnimationFrame fires, which triggers main.tsx's sentry dynamic
 * import. Chrome fetches the sentry chunk, react-snap records it, and
 * injects a <link rel="modulepreload"> for the 151kB sentry chunk.
 *
 * This defeats our deferred sentry strategy: on every real page load,
 * the browser eagerly downloads sentry alongside CSS and fonts, stealing
 * bandwidth during the critical render window.
 *
 * This script removes the injected modulepreload so sentry only downloads
 * when requestAnimationFrame actually fires — well after FCP/LCP.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

const htmlPath = 'dist/index.html';
if (!existsSync(htmlPath)) {
  console.log('strip-eager-chunks: dist/index.html not found, skipping');
  process.exit(0);
}

let html = readFileSync(htmlPath, 'utf-8');
const before = html.length;

// Remove modulepreload for any chunk matching these patterns.
// Sentry (151kB gzip) must never be preloaded — it's only needed on errors.
const STRIP_PATTERNS = [/sentry/i];

STRIP_PATTERNS.forEach(pattern => {
  html = html.replace(
    new RegExp(`<link[^>]*rel=["']modulepreload["'][^>]*href=["'][^"']*${pattern.source}[^"']*["'][^>]*>`, 'gi'),
    ''
  );
  // Also handle reversed attribute order (href before rel)
  html = html.replace(
    new RegExp(`<link[^>]*href=["'][^"']*${pattern.source}[^"']*["'][^>]*rel=["']modulepreload["'][^>]*>`, 'gi'),
    ''
  );
});

writeFileSync(htmlPath, html);
const saved = before - html.length;
console.log(`✓ strip-eager-chunks: removed ${saved} bytes of eager modulepreload from index.html`);
