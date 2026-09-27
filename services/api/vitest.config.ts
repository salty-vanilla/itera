import { defineProject } from 'vitest/config';

// Runs in Node, not workerd: @cloudflare/vitest-pool-workers supports
// Vitest 4 only (ADR 0004). Tests use Hono's app.request() with a stub env.
export default defineProject({
  test: {
    name: 'api',
    include: ['src/**/*.test.ts'],
  },
});
