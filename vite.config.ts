import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import fs from 'fs';

/** Injects <link rel="preload"> for critical fonts into index.html after build,
 *  and converts the blocking <link rel="stylesheet"> to async loading. */
function fontPreloadPlugin(): Plugin {
  return {
    name: 'font-preload',
    writeBundle(options) {
      const outDir = options.dir ?? 'dist';
      const htmlPath = path.join(outDir, 'index.html');
      const assetsDir = path.join(outDir, 'assets');
      if (!fs.existsSync(htmlPath) || !fs.existsSync(assetsDir)) return;

      const fontFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.woff2'));

      // Preload all Noto Serif weights (600 + 700) and Plus Jakarta Sans 400.
      // Both 600 and 700 weights are used in the landing hero — preloading only 700
      // left the 600-weight (LCP element on some viewports) loading at 1,499ms.
      const criticalPatterns = [
        'noto-serif-greek-700-normal',
        'noto-serif-greek-600-normal',
        'noto-serif-latin-700-normal',
        'noto-serif-latin-600-normal',
        'plus-jakarta-sans-latin-400-normal',
        'plus-jakarta-sans-latin-500-normal',
        'plus-jakarta-sans-latin-600-normal',
        'plus-jakarta-sans-latin-700-normal',
      ];

      const preloadTags = criticalPatterns
        .map(pattern => fontFiles.find(f => f.includes(pattern)))
        .filter((f): f is string => Boolean(f))
        .map(f => `  <link rel="preload" as="font" type="font/woff2" href="/assets/${f}" crossorigin>`)
        .join('\n');

      // Modulepreload the two largest lazy entry chunks so the browser fetches
      // them in parallel with the main bundle instead of waiting for React to
      // boot and request them — saves ~400–600ms off the LCP render delay.
      const chunkPatterns = ['Landing-', 'AuthenticatedShell-'];
      const allAssets = fs.readdirSync(assetsDir);
      const modulepreloadTags = chunkPatterns
        .map(prefix => allAssets.find(f => f.startsWith(prefix) && f.endsWith('.js')))
        .filter((f): f is string => Boolean(f))
        .map(f => `  <link rel="modulepreload" crossorigin href="/assets/${f}">`)
        .join('\n');

      let html = fs.readFileSync(htmlPath, 'utf-8');

      // Inject font preloads + chunk modulepreloads before </head>
      const injectTags = [preloadTags, modulepreloadTags].filter(Boolean).join('\n');
      if (injectTags) {
        html = html.replace('</head>', `${injectTags}\n</head>`);
      }

      // NOTE: CSS async loading (preload+onload trick) was tested and reverted.
      // For a React SPA, async CSS causes the browser to recalculate styles on
      // 500+ DOM elements when the sheet arrives after React has already rendered —
      // tripling Style & Layout time (319ms → 971ms) and TBT (70ms → 600ms).
      // Blocking CSS costs ~250ms once; async CSS costs ~971ms in recalculations.

      fs.writeFileSync(htmlPath, html);
    },
  };
}

/** Rewrites the CACHE_NAME token in public/sw.js at build time so it auto-busts on every deploy. */
function swVersionPlugin(): Plugin {
  const cacheVersion = `oli-${Date.now()}`;
  return {
    name: 'sw-version',
    writeBundle(options) {
      const outDir = options.dir ?? 'dist';
      const swPath = path.join(outDir, 'sw.js');
      if (fs.existsSync(swPath)) {
        const content = fs.readFileSync(swPath, 'utf-8');
        fs.writeFileSync(swPath, content.replace('__SW_CACHE_VERSION__', cacheVersion));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), fontPreloadPlugin(), swVersionPlugin()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'external/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    // es2020 + chrome80: react-snap is not used in this project so the old
    // chrome78 constraint has been removed. es2020 eliminates legacy polyfills
    // (Array.from etc.) from vendor and sentry chunks, shrinking them by ~11 KiB.
    target: ['es2020', 'chrome80'],
    rollupOptions: {
      output: {
        manualChunks: {
          // Translation data — large static strings, split for lazy caching
          'i18n-dict': [path.resolve(__dirname, 'src/lib/i18n-dict.ts')],
          // Core React — tiny, loads fast, shared by everything
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Tanstack query — large; separate chunk loads in parallel with vendor
          query: ['@tanstack/react-query'],
          supabase: ['@supabase/supabase-js'],
          // Sentry: NOT pre-declared here — Vite will create its own chunk for the
          // dynamic import in ErrorBoundary, which only loads on actual errors.
          ui: ['lucide-react', 'clsx'],
          analytics: ['posthog-js'],
        },
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
