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
    // The same as the root config (#424), for a run from this package.
    maxWorkers: 4,
    // A screen test takes at most about 1.6 s on a quiet machine and 6.9 s
    // when the machine is loaded far beyond its cores (ADR 0001, #424).
    testTimeout: 10_000,
    // React renders late (src/test/late-render.ts, #401). Not in the usual
    // run: it is for checking that the tests wait for what they look for.
    ...(process.env.ITERA_LATE_RENDER === undefined
      ? {}
      : { setupFiles: ['./src/test/late-render.ts'] }),
  },
});
