import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import fs from 'fs';

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
  plugins: [react(), tailwindcss(), swVersionPlugin()],
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
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
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
