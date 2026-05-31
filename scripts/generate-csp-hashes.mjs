/**
 * generate-csp-hashes.mjs
 *
 * Keeps the Content-Security-Policy `script-src` hashes in vercel.json in sync
 * with the inline <script> blocks in index.html, so the policy can never silently
 * drift again. Runs automatically before every build (see "prebuild" in
 * package.json) in --check mode: if the hashes are out of sync the build FAILS
 * with an actionable message, so a broken CSP can never reach production.
 *
 * Usage:
 *   node scripts/generate-csp-hashes.mjs            # rewrite vercel.json in place
 *   node scripts/generate-csp-hashes.mjs --check    # exit 1 if out of sync (no write)
 *
 * Why hash index.html (source) and not dist/index.html (built)?
 *   `vite build` passes plain inline <script> blocks through byte-for-byte
 *   (verified: source and dist hashes are identical). Hashing source lets this run
 *   as a prebuild step with no dependency on build output. If you ever add a Vite
 *   plugin (or wire in react-snap / critters) that rewrites inline scripts, point
 *   HTML_FILE at the built file and run this as a POSTbuild step instead.
 *
 * What gets hashed: every <script> WITHOUT a `src` attribute whose type is
 *   executable (absent, text/javascript, application/javascript, or module).
 *   <script type="application/ld+json"> is data, not executed, and CSP script-src
 *   does not govern it, so it is correctly skipped.
 */
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML_FILE = resolve(ROOT, 'index.html');
const VERCEL_FILE = resolve(ROOT, 'vercel.json');
const CHECK = process.argv.includes('--check');

const EXECUTABLE_TYPES = new Set(['text/javascript', 'application/javascript', 'module']);

/** Compute the sha256-base64 CSP tokens for every executable inline script. */
function computeInlineHashes(html) {
  const hashes = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const body = m[2];
    if (/\bsrc\s*=/i.test(attrs)) continue; // external script — not an inline hash
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
    if (typeMatch && !EXECUTABLE_TYPES.has(typeMatch[1].toLowerCase())) continue; // e.g. application/ld+json
    if (body.trim() === '') continue; // nothing to execute
    const digest = createHash('sha256').update(body, 'utf8').digest('base64');
    hashes.push(`'sha256-${digest}'`);
  }
  // De-dupe, preserving first-seen order. Two byte-identical scripts share one hash.
  return [...new Set(hashes)];
}

const isHashToken = (tok) => /^'sha(256|384|512)-/.test(tok);

/** Rebuild script-src: keep every non-hash source (keywords + hosts), swap the hashes. */
function rewriteScriptSrc(csp, freshHashes) {
  let found = false;
  const rebuilt = csp.split(';').map((directive) => {
    const trimmed = directive.trim();
    if (!/^script-src\b/.test(trimmed)) return directive;
    found = true;
    const kept = trimmed.split(/\s+/).filter((t) => !isHashToken(t));
    return ' ' + [...kept, ...freshHashes].join(' ');
  });
  if (!found) throw new Error('No script-src directive found in the CSP value.');
  return rebuilt.join(';');
}

function findCspValue(vercel) {
  for (const rule of vercel.headers || []) {
    for (const h of rule.headers || []) {
      if (h.key === 'Content-Security-Policy') return h.value;
    }
  }
  return null;
}

function main() {
  const freshHashes = computeInlineHashes(readFileSync(HTML_FILE, 'utf8'));
  if (freshHashes.length === 0) {
    throw new Error('No inline scripts found in index.html — refusing to write an empty hash set.');
  }

  const vercelRaw = readFileSync(VERCEL_FILE, 'utf8');
  const cspValue = findCspValue(JSON.parse(vercelRaw));
  if (cspValue == null) throw new Error('No Content-Security-Policy header found in vercel.json.');

  const newCsp = rewriteScriptSrc(cspValue, freshHashes);

  if (newCsp === cspValue) {
    console.log(`✓ CSP script-src in sync with index.html (${freshHashes.length} inline-script hashes).`);
    return;
  }

  if (CHECK) {
    const current = cspValue
      .split(';')
      .find((d) => /^\s*script-src\b/.test(d))
      .trim()
      .split(/\s+/)
      .filter(isHashToken);
    console.error('✗ CSP script-src is OUT OF SYNC with the inline scripts in index.html.');
    console.error(`  index.html needs ${freshHashes.length} hash(es); vercel.json has ${current.length}.`);
    console.error('  Expected script-src hashes:');
    freshHashes.forEach((h) => console.error('    ' + h));
    console.error('  Fix: run  npm run csp:hashes  then commit vercel.json.');
    process.exit(1);
  }

  // Write mode — minimal diff: swap only the CSP value string, preserve all other formatting.
  const updated = vercelRaw.replace(JSON.stringify(cspValue), JSON.stringify(newCsp));
  if (updated === vercelRaw) {
    throw new Error('Could not substitute the CSP value in vercel.json (verbatim string not found).');
  }
  writeFileSync(VERCEL_FILE, updated);
  console.log(`✓ Updated vercel.json script-src with ${freshHashes.length} inline-script hash(es):`);
  freshHashes.forEach((h) => console.log('    ' + h));
}

main();
