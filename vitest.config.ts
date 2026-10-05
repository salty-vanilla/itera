import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Not one worker per core (the default): the jsdom tests of apps/web
    // spend CPU for most of their time, so a run that shares the machine
    // (other worktrees, a dev server) stretches each test past the 5 s
    // timeout without finishing sooner. Four is what CI's runner has
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
