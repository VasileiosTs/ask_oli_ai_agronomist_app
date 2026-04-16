import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import fs from 'fs';

/** Injects <link rel="preload"> for the two most critical fonts into index.html after build. */
function fontPreloadPlugin(): Plugin {
  return {
    name: 'font-preload',
    writeBundle(options) {
      const outDir = options.dir ?? 'dist';
      const htmlPath = path.join(outDir, 'index.html');
      const assetsDir = path.join(outDir, 'assets');
      if (!fs.existsSync(htmlPath) || !fs.existsSync(assetsDir)) return;

      const fontFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.woff2'));
      // Preload the two fonts used above-the-fold on the landing page
      const criticalPatterns = [
        'noto-serif-latin-700-normal',
        'plus-jakarta-sans-latin-400-normal',
      ];

      const preloadTags = criticalPatterns
        .map(pattern => fontFiles.find(f => f.includes(pattern)))
        .filter((f): f is string => Boolean(f))
        .map(f => `  <link rel="preload" as="font" type="font/woff2" href="/assets/${f}" crossorigin>`)
        .join('\n');

      if (!preloadTags) return;

      let html = fs.readFileSync(htmlPath, 'utf-8');
      html = html.replace('</head>', `${preloadTags}\n</head>`);
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
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    // Target Chrome 78 (puppeteer bundled in react-snap) so optional-chaining
    // and nullish-coalescing are transpiled. Modern Chrome (Lighthouse) executes
    // the same logic — just slightly more verbose compiled output.
    target: ['chrome78'],
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
