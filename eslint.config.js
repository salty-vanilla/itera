import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import storybook from 'eslint-plugin-storybook';

// What services/api's production code must not import (ADR 0005, ADR 0006).
const apiImportPatterns = [
  {
    regex: '^@itera/application/fixtures$',
    message: 'The fixture is for tests and the browser mock only.',
  },
  {
    regex: '(^|/)operation-cases$',
    message: "operation-cases.ts is the tests' helper.",
  },
  {
    regex: '^@itera/api-contract/(client|create-client|react-query)$',
    message: "The API takes the contract's types and schemas only (ADR 0006).",
  },
  testingImportPattern(),
];

/**
 * `@itera/api-contract/testing` is the tests' helper (operation examples,
 * IDs): production code does not import it (ADR 0006 生成物).
 */
function testingImportPattern() {
  return {
    regex: '^@itera/api-contract/testing$',
    message: "@itera/api-contract/testing is the tests' helper.",
  };
}

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

// Better Auth's client stays in the one module that implements `Auth`
// (apps/web/src/auth/better-auth.ts, #278); the rest of apps/web uses the
// interface, which the browser mock answers too. Put in both blocks below,
// as their ignores differ: a file left out of one is still checked by the
// other. Files out of both (the mock and the tests) are not checked.
const WEB_BETTER_AUTH = 'apps/web/src/auth/better-auth.ts';
const webBetterAuthPattern = {
  regex: '^(better-auth|@better-auth/)',
  message:
    'Use Auth (@/auth/auth-provider); Better Auth stays in src/auth/better-auth.ts.',
};

// Outside the rule: the tests and their helpers, which open the fixture's
// records, and the browser mock (the server's stand-in).
const WEB_NOT_SCREENS = [
  'apps/web/src/**/*.test.{ts,tsx}',
  'apps/web/src/test/**',
  'apps/web/src/mock/**',
];

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
    // apps/web takes the records and the derived values from the contract
    // (ADR 0005 API への移行の改訂, PRD §14). packages/domain only through
    // the one module of previews and dates, packages/application not at
    // all; type imports too. Two rules, so that neither replaces the other.
    files: ['apps/web/src/**/*.{ts,tsx}', 'apps/web/.storybook/**/*.{ts,tsx}'],
    ignores: [
      ...WEB_NOT_SCREENS,
      'apps/web/src/lib/domain-functions.ts',
      WEB_BETTER_AUTH,
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            webBetterAuthPattern,
            testingImportPattern(),
            {
              regex: '^@itera/domain(/|$)',
              message:
                'Take the types from the contract (@itera/api-contract) and the previews and dates from @/lib/domain-functions (ADR 0005).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}', 'apps/web/.storybook/**/*.{ts,tsx}'],
    ignores: [...WEB_NOT_SCREENS, WEB_BETTER_AUTH],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            webBetterAuthPattern,
            testingImportPattern(),
            {
              regex: '^@itera/application(/|$)',
              message:
                'Only the browser mock runs packages/application; the screens use the contract (ADR 0005).',
            },
          ],
        },
      ],
    },
  },
  {
    // The one module of Better Auth's client is checked for everything but
    // Better Auth: it takes neither package.
    files: [WEB_BETTER_AUTH],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            testingImportPattern(),
            {
              regex: '^@itera/domain(/|$)',
              message:
                'Better Auth stays apart from packages/domain (ADR 0005).',
            },
          ],
        },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            testingImportPattern(),
            {
              regex: '^@itera/application(/|$)',
              message:
                'Better Auth stays apart from packages/application (ADR 0005).',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'apps/web/*.ts',
      'apps/web/scripts/**',
      'apps/web/.storybook/main.ts',
    ],
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
    // API's production code. handlers/operation-cases.ts is the tests' own
    // helper (the app on a fixture state); nothing but tests imports it.
    files: ['services/api/src/**/*.ts'],
    ignores: [
      'services/api/src/**/*.test.ts',
      'services/api/src/handlers/operation-cases.ts',
    ],
    rules: {
      'no-restricted-imports': ['error', { patterns: apiImportPatterns }],
    },
  },
  {
    // Handlers and middleware use `c.var` and the injected dependencies'
    // types only (.claude/rules/api.md, ADR 0004 依存の組み立て方). D1 and
    // Better Auth, and the env values for them, belong to the production
    // composition and the Better Auth module.
    files: ['services/api/src/**/*.ts'],
    ignores: [
      'services/api/src/**/*.test.ts',
      'services/api/src/handlers/operation-cases.ts',
      'services/api/src/test-env.ts',
      'services/api/src/default-dependencies.ts',
      'services/api/src/auth/better-auth.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...apiImportPatterns,
            {
              regex: '^drizzle-orm/d1$',
              message:
                'Use c.var.db (Database); only default-dependencies.ts picks D1.',
            },
            {
              regex: '^(better-auth|@better-auth/)',
              message:
                'Use the injected Authenticator; Better Auth stays in src/auth/better-auth.ts.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MemberExpression[property.name=/^(DB|BETTER_AUTH_\\w+|GOOGLE_\\w+|SIGN_UP_ALLOWED_EMAILS)$/]',
          message:
            'Read bindings in default-dependencies.ts or src/auth/better-auth.ts and inject what they make.',
        },
      ],
    },
  },
  {
    // packages/api-contract depends on packages/application by its types
    // only: the operations' names and inputs that requests.ts carries
    // (ADR 0006 経路の形, ADR 0007 依存の向き). Its runtime stays the
    // contract's: the generated code and Valibot. testing.ts and the tests
    // run the application (examples, IDs).
    files: ['packages/api-contract/src/**/*.ts'],
    ignores: [
      'packages/api-contract/src/**/*.test.ts',
      'packages/api-contract/src/testing.ts',
      'packages/api-contract/src/generated/**',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^@itera/application(/|$)',
              allowTypeImports: true,
              message:
                "The contract takes packages/application's types only (ADR 0007 依存の向き).",
            },
            {
              regex: '^@itera/domain(/|$)',
              message:
                'The contract does not depend on packages/domain (ADR 0007 依存の向き).',
            },
            { ...testingImportPattern(), regex: '(^|/)testing$' },
          ],
        },
      ],
    },
  },
  {
    // The browser mock: the tests' helper stays out of it too (the screens'
    // rules above say so for the rest of apps/web).
    files: ['apps/web/src/mock/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/mock/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [testingImportPattern()] },
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
