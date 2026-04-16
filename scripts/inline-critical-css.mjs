/**
 * Inlines critical (above-the-fold) CSS into the prerendered index.html
 * and converts the full stylesheet link to a non-blocking preload.
 *
 * Must run AFTER react-snap so critters sees the prerendered HTML content.
 * Running before react-snap is wrong: react-snap's Chrome would fire the
 * onload handler and change rel="preload" back to rel="stylesheet", making
 * the full CSS render-blocking again.
 *
 * Pipeline: vite build → react-snap → inline-critical-css → strip-eager-chunks
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const htmlPath = 'dist/index.html';
if (!existsSync(htmlPath)) {
  console.log('inline-critical-css: dist/index.html not found, skipping');
  process.exit(0);
}

const Critters = require('critters');

const critters = new Critters({
  // Where to find CSS assets referenced in the HTML
  path: 'dist',
  // Public URL prefix matching Vite's output
  publicPath: '/',
  // Convert <link rel="stylesheet"> to <link rel="preload" onload="...">
  // so the full CSS loads asynchronously after critical CSS is inlined.
  preload: 'swap',
  // Add <noscript><link rel="stylesheet"> fallback for no-JS browsers
  noscriptFallback: true,
  // Don't touch @font-face rules — fonts are handled by preload tags
  fonts: false,
  // Don't remove used rules from the external CSS file
  pruneSource: false,
});

const html = readFileSync(htmlPath, 'utf-8');
const result = await critters.process(html);
writeFileSync(htmlPath, result);

const saved = html.length - result.length;
const direction = saved >= 0 ? 'reduced' : 'increased';
console.log(`✓ inline-critical-css: stylesheet is now non-blocking (HTML ${direction} by ${Math.abs(saved)} bytes)`);
