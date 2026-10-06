import { defineConfig, devices } from '@playwright/test';
import { origin } from './e2e/local-worker.ts';

// E2E tests from the browser through the Worker's static assets, the API and
// a local D1 (Issue #370, ADR 0008). They need the Web app's build
// (apps/web/dist): run them with `pnpm e2e` at the root, which builds it
// first. The tests share one database and run in order.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  // A retry would meet the rows the first try wrote.
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: origin,
    // The user's settings take the browser's time zone.
    timezoneId: 'Asia/Tokyo',
    locale: 'ja-JP',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/start-worker.ts',
    url: `${origin}/api/me`,
    // Never another checkout's Worker: its database is not this run's.
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
