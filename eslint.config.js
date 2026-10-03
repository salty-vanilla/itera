import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import storybook from 'eslint-plugin-storybook';

/**
 * packages/domain and packages/application are pure: the current time,
 * randomness and IDs come in as arguments (.claude/rules/domain.md, ADR 0005
 * アプリケーション層).
 * @param {string} name
 * @returns {import('eslint').Linter.RulesRecord}
 */
function pureRules(name) {
  return {
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
    'no-restricted-globals': [
      'error',
      ...[
        'globalThis',
        'window',
        'self',
        'document',
        'navigator',
        'localStorage',
        'sessionStorage',
        'fetch',
        'process',
        'Buffer',
        'require',
        'crypto',
        'performance',
        'setTimeout',
        'setInterval',
        'queueMicrotask',
        'structuredClone',
      ].map((global) => ({
        name: global,
        message: `${name} is pure: take it as an argument.`,
      })),
    ],
  };
}

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
      'services/api/worker-configuration.d.ts',
      // Generated from the contract (ADR 0006); checked by contract:check.
      'packages/api-contract/src/generated/**',
      'services/api/.wrangler/**',
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
    // packages/domain product code: pure TypeScript. The current time,
    // randomness and IDs come in as arguments (.claude/rules/domain.md).
    // packages/domain/tsconfig.json also leaves out DOM and Node types, so
    // those APIs are type errors; these rules are the second line.
    files: ['packages/domain/src/**/*.ts'],
    ignores: [
      'packages/domain/src/**/*.test.ts',
      'packages/domain/src/testing.ts',
    ],
    rules: {
      ...pureRules('packages/domain'),
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^node:',
              message: 'packages/domain must not depend on Node.',
            },
          ],
        },
      ],
    },
  },
  {
    // packages/application: shared by the API (Workers) and the browser
    // mock, so it stays as pure as packages/domain: the current time and
    // random bytes come in as arguments, and it knows nothing of React or
    // apps/web (ADR 0005 アプリケーション層).
    files: ['packages/application/src/**/*.ts'],
    ignores: [
      'packages/application/src/**/*.test.ts',
      'packages/application/src/testing.ts',
    ],
    rules: {
      ...pureRules('packages/application'),
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^node:',
              message: 'packages/application must not depend on Node.',
            },
            {
              regex: '^(react|react-dom)(/|$)',
              message: 'packages/application must not depend on React.',
            },
            {
              regex: '^(@/|@itera/web(/|$))',
              message: 'packages/application must not depend on apps/web.',
            },
          ],
        },
      ],
    },
  },
  {
    // The fixture is for tests and the browser mock (ADR 0005), not for the
    // API's production code.
    files: ['services/api/src/**/*.ts'],
    ignores: ['services/api/src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^@itera/application/fixtures$',
              message: 'The fixture is for tests and the browser mock only.',
            },
            {
              regex: '^@itera/api-contract/(client|react-query)$',
              message:
                "The API takes the contract's types and schemas only (ADR 0006).",
            },
          ],
        },
      ],
    },
  },
  {
    // packages/api-contract: generating and checking the generated code
    // runs on Node.
    files: ['packages/api-contract/scripts/**', 'packages/api-contract/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // services/api: its build and tool configs run on Node. The Worker code
    // gets its globals from the generated worker-configuration.d.ts.
    files: ['services/api/*.ts'],
    languageOptions: { globals: globals.node },
  },
  // Applies to *.stories.* and .storybook/main.* only. The cast is for the
  // plugin's types, which declare `files: undefined` and `plugins: undefined`
  // and so fail under exactOptionalPropertyTypes.
  .../** @type {import('eslint').Linter.Config[]} */ (
    /** @type {unknown} */ (storybook.configs['flat/recommended'])
  ),
);
