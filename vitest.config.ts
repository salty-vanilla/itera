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
      // Each workspace package brings its own vitest config as it is added.
      'packages/*',
      'apps/*',
      'services/*',
    ],
  },
});
