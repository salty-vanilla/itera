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
];

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

/**
 * The files of apps/web still on the store until their screen moves to the
 * contract (#272 import の境界), with what each imports: `domain`
 * (@itera/domain) or `application` (@itera/application). A file in no list
 * takes the contract only. Each screen's Issue removes its files; #277
 * empties the lists and removes them (ADR 0005 API への移行の改訂).
 * Listed by name, not by pattern, so that a new file is held to the rule.
 * @type {Record<string, Record<string, ('domain' | 'application')[]>>}
 */
const MIGRATING = {
  // #274: the Sprint (Planning and running).
  '#274': {
    'apps/web/src/screens/planning/backlog-pane.tsx': ['domain'],
    'apps/web/src/screens/planning/check-summary.tsx': ['domain'],
    'apps/web/src/screens/planning/plan-pane.tsx': ['domain'],
    'apps/web/src/screens/planning/planned-source.ts': ['domain'],
    'apps/web/src/screens/planning/planning-screen.tsx': ['domain'],
    'apps/web/src/screens/sprint-screen.tsx': ['domain'],
    'apps/web/src/screens/sprint/running-sprint.tsx': ['domain'],
    'apps/web/src/store/use-planning.ts': ['domain', 'application'],
    'apps/web/src/store/use-running-sprint.ts': ['domain', 'application'],
    'apps/web/src/store/use-sprint-choice.ts': ['application'],
  },
  // #275: Today.
  '#275': {
    'apps/web/src/screens/today/day-frame.tsx': ['domain'],
    'apps/web/src/screens/today/day-header.tsx': ['domain'],
    'apps/web/src/screens/today/interrupt-row.tsx': ['domain'],
    'apps/web/src/screens/today/other-day.tsx': ['domain'],
    'apps/web/src/screens/today/today-row.tsx': ['domain'],
    'apps/web/src/screens/today/today-screen.tsx': ['domain'],
    'apps/web/src/store/use-today.ts': ['domain', 'application'],
  },
  // #276: the Retro.
  '#276': {
    'apps/web/src/screens/retro/facts-pane.tsx': ['domain'],
    'apps/web/src/screens/retro/handoff-pane.tsx': ['domain'],
    'apps/web/src/screens/retro/materials.tsx': ['domain'],
    'apps/web/src/screens/retro/reflect-pane.tsx': ['domain'],
    'apps/web/src/screens/retro/retro-screen.tsx': ['domain'],
    'apps/web/src/screens/retro/retro-words.tsx': ['domain'],
    'apps/web/src/screens/retro/task-result.tsx': ['domain'],
    'apps/web/src/screens/retro/task-values.ts': ['domain'],
    'apps/web/src/store/use-retro.ts': ['domain', 'application'],
  },
  // shared by the screens: removed by the Issue that moves their last user, #277 at the latest.
  shared: {
    'apps/web/src/components/sprint/capacity-indicator.tsx': ['domain'],
    'apps/web/src/components/task/area-select.stories.tsx': ['domain'],
    'apps/web/src/components/task/estimate-suggestion.stories.tsx': ['domain'],
    'apps/web/src/components/task/task-quick-add.stories.tsx': ['domain'],
    'apps/web/src/components/task/task-row.stories.tsx': ['domain'],
    'apps/web/src/lib/criterion-text.ts': ['domain'],
    'apps/web/src/lib/selection-words.ts': ['domain'],
    'apps/web/src/lib/week-text.ts': ['application'],
    'apps/web/src/store/record-store.ts': ['application'],
    'apps/web/src/store/store-provider.tsx': ['application'],
    'apps/web/src/store/use-app-overview.ts': ['application'],
    'apps/web/src/store/use-run.ts': ['domain', 'application'],
    'apps/web/src/store/use-system-day.ts': ['application'],
    'apps/web/src/store/views.ts': ['domain', 'application'],
  },
};

/** @param {'domain' | 'application'} pkg */
function migratingOn(pkg) {
  return Object.values(MIGRATING).flatMap((files) =>
    Object.entries(files)
      .filter(([, uses]) => uses.includes(pkg))
      .map(([file]) => file),
  );
}

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
      ...migratingOn('domain'),
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
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
    ignores: [...WEB_NOT_SCREENS, ...migratingOn('application')],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
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
