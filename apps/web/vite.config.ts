import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The API for `--mode api` (`pnpm --filter @itera/web dev:api`): the dev
// server sends `/api` to `wrangler dev`, so the browser sees one origin, as
// in production (ADR 0004 Web と API の配信). The Host and Origin stay the
// dev server's, which BETTER_AUTH_URL must then name (README).
const apiOrigin = process.env.ITERA_API_ORIGIN ?? 'http://localhost:8787';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: mode === 'api' ? { '/api': { target: apiOrigin } } : {},
  },
}));
