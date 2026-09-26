import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
