import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Not one worker for each core but one (the default): the jsdom tests of
    // apps/web spend CPU for most of their time, so a run that shares the
    // machine (other worktrees, a dev server) stretches each test past its
    // timeout without finishing sooner. CI's runner has four CPUs. Keep
    // apps/web/vitest.config.ts the same: Vitest stops when they differ
    // (ADR 0001, #424).
    maxWorkers: 4,
    projects: [
      // Repository tooling and Agent hooks.
      {
        test: {
          name: 'tooling',
          include: ['tooling/**/*.test.mjs', '.claude/hooks/**/*.test.mjs'],
        },
      },
      // Each workspace package must have its own vitest.config.ts; a package
      // without one is not tested. Matching the config file (not the
      // directory) also keeps stray files such as .gitkeep from breaking this.
      '{apps,packages,services}/*/vitest.config.{ts,mts,js,mjs}',
    ],
  },
});
