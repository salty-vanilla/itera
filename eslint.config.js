import { readFileSync } from 'node:fs';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import storybook from 'eslint-plugin-storybook';

/**
 * A relative path never leaves a package: another package is imported by its
 * name (`@itera/...`), and pnpm's resolution does not stop `../../application`
 * the way it stops a name the package does not depend on (ADR 0007 依存の向き).
 * It looks at the first segment after the `../`s: the repository's top
 * directories, or a sibling under packages/. A relative path inside the
 * package (`../api/...`, `../lib/...`) is not stopped. Put in every block
 * of product code below that sets `no-restricted-imports` (or the
 * typescript-eslint one), as a later block replaces an earlier one's options.
 */
const relativeToOtherPackagePattern = {
  regex:
    '^(\\.\\./)+((packages|services|apps)/|(domain|application|api-contract)(/|$))',
  message:
    'Import another package by its name (@itera/...), not by a relative path (ADR 0007 依存の向き).',
};

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
  relativeToOtherPackagePattern,
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

const webDomainPattern = {
  regex: '^@itera/domain(/|$)',
  message:
    'Take the types from the contract (@itera/api-contract) and the previews and dates from @/lib/domain-functions (ADR 0005).',
};

// src/screen-data/ shapes the contract for the screens; the layers under
// the screens (api, components, lib, auth, foundations) never import it
// (ADR 0005 置き場所の規則).
const webScreenDataPattern = {
  regex: '^(@/|(\\.\\./)+)screen-data(/|$)',
  message:
    'Only the screens import src/screen-data/; api, components, lib, auth and foundations stay below them (ADR 0005 置き場所の規則).',
};

// src/screen-data/ is under the screens, so it does not import them back
// (ADR 0005 置き場所の規則), by `@/screens` or by a relative path.
const webScreensPattern = {
  regex: '^(@/|(\\.\\./)+)screens(/|$)',
  message:
    'src/screen-data/ stays below the screens: it does not import src/screens/ (ADR 0005 置き場所の規則).',
};

// Only the browser mock builds requests (ADR 0007: the screens use the
// types of @itera/api-contract/sending).
const webRequestsPattern = {
  regex: '^@itera/api-contract/requests$',
  message:
    'Only the browser mock (src/mock/) uses @itera/api-contract/requests; the screens use the types of @itera/api-contract/sending (ADR 0007).',
};

// What every file of apps/web outside the mock and the tests leaves
// unimported; the blocks below add to it, since a later block replaces the
// options of an earlier one.
const webBasePatterns = [
  webBetterAuthPattern,
  testingImportPattern(),
  webRequestsPattern,
  relativeToOtherPackagePattern,
];
const WEB_LAYERS = [
  'apps/web/src/{api,components,lib,auth,foundations}/**/*.{ts,tsx}',
];

// Outside the rule: the tests and their helpers, which open the fixture's
// records, and the browser mock (the server's stand-in).
const WEB_NOT_SCREENS = [
  'apps/web/src/**/*.test.{ts,tsx}',
  'apps/web/src/test/**',
  'apps/web/src/mock/**',
];

// apps/web takes its colors from the tokens (DESIGN.md → tokens.css), so a
// color written in a .ts / .tsx file is a drift from them (.claude/rules/
// web-ui.md). Tailwind 4 makes a class out of an arbitrary value even with
// the default theme removed, so the tokens alone do not stop `bg-[#ff0000]`.
// `color-mix()` stays: it mixes colors that are already there (Kbd's faded
// outline), and a hex written inside it is found by the first pattern.
//
// A hex of 3 or 4 digits with no letter is also an Issue number in a test's
// name ("(#332)"), so it counts only where a value stands: at the start of
// the text or after `[`, `:`, `;` or `=`, and not closing a parenthesis.
const COLOR_PATTERNS = [
  {
    // `#rrggbb` and `#rrggbbaa`; `#rgb` and `#rgba` with a letter in them.
    regex:
      '(^|[^\\w&])#([0-9a-fA-F]{6}|[0-9a-fA-F]{8}|(?=[0-9]*[a-fA-F])[0-9a-fA-F]{3,4})(?![\\w-])',
    message: 'a hex color',
  },
  {
    regex: '(^|[\\[:;=]\\s*)#[0-9]{3,4}(?![\\w)-])',
    message: 'a hex color',
  },
  {
    regex: '(^|[^\\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(',
    message: 'a color function',
  },
  {
    regex:
      '(^|[^\\w-])color\\(\\s*(from|srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz|xyz-d50|xyz-d65)\\b',
    message: 'a color function',
  },
  {
    // `text-[color:…]`, `text-(color:--x)` and the arbitrary property
    // `[color:…]`. `bg-(--ink)` (a variable of a token) is not stopped.
    regex: '(^|[\\s:])\\[color:|-[\\[(]color:',
    message: 'a Tailwind arbitrary color',
  },
];

/** @param {string} regex @param {string} message */
function textSyntax(regex, message) {
  return ['Literal', 'TemplateElement', 'JSXText'].map((type) => ({
    selector:
      type === 'TemplateElement'
        ? `TemplateElement[value.raw=/${regex}/]`
        : `${type}[value=/${regex}/]`,
    message,
  }));
}

const colorSyntax = COLOR_PATTERNS.flatMap(({ regex, message }) =>
  textSyntax(
    regex,
    `Write ${message} with a token (DESIGN.md Colors, .claude/rules/web-ui.md), not as a value here.`,
  ),
);

// An Area is called Area (AGENTS.md ドメインの扱い). "domain" in apps/web
// is the domain layer: `@itera/domain`, `domain-functions`, "ドメインモデル"
// and the names below, which wrap its errors. A name with "domain" that is
// not one of them is stopped, so that an Area does not come back as
// `Domain`, `domainId` and so on. Add to the list only a name of the layer.
// In a text only the capital word `Domain` and ドメイン are stopped: a
// lowercase `domain` is the layer, in a test's name or a path (`@itera/domain`).
const DOMAIN_LAYER_NAMES =
  '^(Domain(Error|Instant|LocalDate|TimeZone)|DOMAIN_PROBLEMS|domainFailure|keptByDomain)$';
const domainSyntax = [
  {
    selector: `:matches(Identifier, JSXIdentifier)[name=/[Dd][Oo][Mm][Aa][Ii][Nn]/]:not([name=/${DOMAIN_LAYER_NAMES}/])`,
    message:
      'Call an Area an Area (AGENTS.md ドメインの扱い). A name of the domain layer goes in DOMAIN_LAYER_NAMES (eslint.config.js).',
  },
  ...textSyntax(
    '\\bDomain\\b|ドメイン(?!モデル)',
    'The word for an Area is 領域 (Area in code); not "Domain" or ドメイン (AGENTS.md ドメインの扱い).',
  ),
];

// Where a color is itself the subject: the contrast test takes the values
// of the tokens in and computes their ratios.
const WEB_COLOR_VALUE_TESTS = ['apps/web/src/foundations/contrast.test.ts'];

// Skills taken from upstream stay byte for byte and are not linted; the
// skills authored in this repository (localSkills in
// tooling/agents/sources.json) are.
const localSkills = JSON.parse(
  readFileSync(new URL('tooling/agents/sources.json', import.meta.url), 'utf8'),
).localSkills.map((skill) => `!${skill.destination}`);

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
      '.agents/skills/*',
      ...localSkills,
      'apps/web/storybook-static/**',
      'services/api/worker-configuration.d.ts',
      // Generated from the contract (ADR 0006); checked by contract:check.
      'packages/api-contract/src/generated/**',
      'services/api/.wrangler/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Repository tooling, hooks, skill scripts and root config files run on
    // Node.
    files: ['tooling/**', '.claude/**', '.agents/**', '*.{js,mjs,ts}'],
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
          patterns: [...webBasePatterns, webDomainPattern],
        },
      ],
    },
  },
  {
    // src/screen-data/ does not reach up to the screens either. It repeats
    // the rule above for these files, for the same reason as the next block.
    files: ['apps/web/src/screen-data/**/*.{ts,tsx}'],
    ignores: WEB_NOT_SCREENS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [...webBasePatterns, webDomainPattern, webScreensPattern],
        },
      ],
    },
  },
  {
    // The layers under the screens do not reach up to them. This block
    // repeats the domain rule above for these files, since a later block
    // replaces an earlier one's options; the two files the domain rule
    // leaves out have a block of their own below.
    files: WEB_LAYERS,
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
            ...webBasePatterns,
            webDomainPattern,
            webScreenDataPattern,
          ],
        },
      ],
    },
  },
  {
    // The one module that may import packages/domain is still a layer
    // under the screens.
    files: ['apps/web/src/lib/domain-functions.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [...webBasePatterns, webScreenDataPattern],
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
            webRequestsPattern,
            relativeToOtherPackagePattern,
            webScreenDataPattern,
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
    // No color written as a value, and no "Domain" for an Area, in the code
    // of apps/web (.claude/rules/web-ui.md, AGENTS.md ドメインの扱い). Both
    // rules go through `no-restricted-syntax`, which a later block replaces
    // as a whole: add to the arrays above, not to another block of these files.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: WEB_COLOR_VALUE_TESTS,
    rules: {
      'no-restricted-syntax': ['error', ...colorSyntax, ...domainSyntax],
    },
  },
  {
    files: WEB_COLOR_VALUE_TESTS,
    rules: { 'no-restricted-syntax': ['error', ...domainSyntax] },
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
            relativeToOtherPackagePattern,
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
            relativeToOtherPackagePattern,
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
    // only: the operations' names and inputs that sending.ts and requests.ts
    // carry (ADR 0006 経路の形, ADR 0007 依存の向き). Its runtime stays the
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
            relativeToOtherPackagePattern,
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
        { patterns: [testingImportPattern(), relativeToOtherPackagePattern] },
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
    // services/api: its build and tool configs and its E2E tests (Issue
    // #370) run on Node. The Worker code gets its globals from the generated
    // worker-configuration.d.ts.
    files: ['services/api/*.ts', 'services/api/e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  // Applies to *.stories.* and .storybook/main.* only. The cast is for the
  // plugin's types, which declare `files: undefined` and `plugins: undefined`
  // and so fail under exactOptionalPropertyTypes.
  .../** @type {import('eslint').Linter.Config[]} */ (
    /** @type {unknown} */ (storybook.configs['flat/recommended'])
  ),
);
