import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import storybook from 'eslint-plugin-storybook';

// Keep ESLint configuration in this one file. ESLint 10 looks up the nearest
// eslint.config.* per directory, so a nested config would replace this one
// for its subtree instead of extending it. Add package rules here with `files`.
export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '.tools/**',
      '.devbox/**',
      '.direnv/**',
      '.playwright/**',
      '.playwright-cli/**',
      '.agents/skills/**',
      'apps/web/storybook-static/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Repository tooling, hooks and root config files run on Node.
    files: ['tooling/**', '.claude/**', '*.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    // apps/web: React in the browser. Its build configs run on Node.
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/web/*.ts', 'apps/web/.storybook/main.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // packages/domain: pure TypeScript. The current time and randomness come
    // in as arguments (.claude/rules/domain.md). No browser or Node globals
    // are declared, so `no-undef`-style type errors also catch those APIs.
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'Take the current time as an argument.',
        },
        {
          object: 'Math',
          property: 'random',
          message: 'Take IDs and random values as arguments.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Take the current time as an argument.',
        },
        {
          selector: "CallExpression[callee.name='Date'][arguments.length=0]",
          message: 'Take the current time as an argument.',
        },
      ],
    },
  },
  // Applies to *.stories.* and .storybook/main.* only. The cast is for the
  // plugin's types, which declare `files: undefined` and `plugins: undefined`
  // and so fail under exactOptionalPropertyTypes.
  .../** @type {import('eslint').Linter.Config[]} */ (
    /** @type {unknown} */ (storybook.configs['flat/recommended'])
  ),
);
