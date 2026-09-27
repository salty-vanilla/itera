import { defineProject } from 'vitest/config';

// Runs in Node, not workerd: @cloudflare/vitest-pool-workers supports
// Vitest 4 only (ADR 0004). Tests call Hono's app.request() with injected
// dependencies (a recording database and fake authenticators).
export default defineProject({
  test: {
    name: 'api',
    include: ['src/**/*.test.ts'],
  },
});
