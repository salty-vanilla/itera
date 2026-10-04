import { fileURLToPath, URL } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // React renders late (src/test/late-render.ts, #401). Not in the usual
    // run: it is for checking that the tests wait for what they look for.
    ...(process.env.ITERA_LATE_RENDER === undefined
      ? {}
      : { setupFiles: ['./src/test/late-render.ts'] }),
  },
});
