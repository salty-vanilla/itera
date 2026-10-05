import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// The rules in eslint.config.js that stop a relative path into another
// package, and an import from src/screen-data/ back to src/screens/ (ADR 0005
// 置き場所の規則, ADR 0007 依存の向き), run on text instead of on the
// repository's files. Each package has several blocks that set
// `no-restricted-imports`, and a later block replaces an earlier one's
// options: the cases below go through every block, so that a pattern missing
// from one of them is found here.
const eslint = new ESLint({
  cwd: fileURLToPath(new URL('../..', import.meta.url)),
});

async function restricted(code, path) {
  const [result] = await eslint.lintText(code, { filePath: path });
  // A syntax error or an ignored file also gives "no message".
  const unlinted = result?.messages.filter(
    (m) => m.fatal || /ignored/.test(m.message),
  );
  if (!result || unlinted?.length) {
    throw new Error(`not linted: ${path} ${JSON.stringify(unlinted)}`);
  }
  return result.messages.filter((m) =>
    /no-restricted-imports$/.test(m.ruleId ?? ''),
  );
}

const imports = (source) => `import { x } from '${source}';\nexport { x };`;

describe('a relative path into another package', () => {
  it.each([
    // packages/domain, at the depth of src/ and below it
    [
      'domain → application',
      'packages/domain/src/a.ts',
      '../../application/src/a',
    ],
    [
      'domain → application, one directory down',
      'packages/domain/src/sub/a.ts',
      '../../../application/src/a',
    ],
    [
      'domain → services/api',
      'packages/domain/src/a.ts',
      '../../../services/api/src/a',
    ],
    [
      'domain → api-contract',
      'packages/domain/src/a.ts',
      '../../api-contract/src/a',
    ],
    // packages/application
    [
      'application → services/api',
      'packages/application/src/a.ts',
      '../../../services/api/src/a',
    ],
    [
      'application → apps/web',
      'packages/application/src/a.ts',
      '../../../apps/web/src/a',
    ],
    [
      'application → domain (a name, not a path)',
      'packages/application/src/a.ts',
      '../../domain/src/a',
    ],
    // packages/api-contract
    [
      'api-contract → domain',
      'packages/api-contract/src/a.ts',
      '../../domain/src/a',
    ],
    [
      'api-contract → application',
      'packages/api-contract/src/a.ts',
      '../../application/src/a',
    ],
    // services/api: both of its blocks
    ['api → apps/web', 'services/api/src/a.ts', '../../../apps/web/src/a'],
    [
      'api → application',
      'services/api/src/handlers/a.ts',
      '../../../../packages/application/src/a',
    ],
    [
      'api (default-dependencies.ts) → apps/web',
      'services/api/src/default-dependencies.ts',
      '../../../apps/web/src/a',
    ],
    // apps/web: each block that sets the rule
    [
      'web screens → api-contract',
      'apps/web/src/screens/a.tsx',
      '../../../../packages/api-contract/src/a',
    ],
    [
      'web components → application',
      'apps/web/src/components/a.tsx',
      '../../../../packages/application/src/a',
    ],
    [
      'web screen-data → services/api',
      'apps/web/src/screen-data/a.ts',
      '../../../../services/api/src/a',
    ],
    [
      'web lib/domain-functions.ts → domain',
      'apps/web/src/lib/domain-functions.ts',
      '../../../../packages/domain/src/a',
    ],
    [
      'web auth/better-auth.ts → api',
      'apps/web/src/auth/better-auth.ts',
      '../../../../services/api/src/a',
    ],
    [
      'web mock → domain',
      'apps/web/src/mock/a.ts',
      '../../../../packages/domain/src/a',
    ],
    [
      'web .storybook → api-contract',
      'apps/web/.storybook/a.ts',
      '../../../packages/api-contract/src/a',
    ],
  ])('stops %s', async (_name, path, source) => {
    expect(await restricted(imports(source), path)).not.toHaveLength(0);
  });

  it('lets api-contract take the types of application by its name', async () => {
    expect(
      await restricted(
        "import type { X } from '@itera/application';",
        'packages/api-contract/src/a.ts',
      ),
    ).toHaveLength(0);
  });

  it('stops a type import and a re-export too', async () => {
    const path = 'packages/api-contract/src/a.ts';
    expect(
      await restricted(
        "import type { X } from '../../application/src/a';",
        path,
      ),
    ).not.toHaveLength(0);
    expect(
      await restricted("export * from '../../application/src/a';", path),
    ).not.toHaveLength(0);
  });

  it.each([
    ['a name of a package', 'services/api/src/a.ts', '@itera/application'],
    [
      'a name of a subpath',
      'apps/web/src/screens/a.tsx',
      '@itera/api-contract/sending',
    ],
    ['a path inside the package', 'services/api/src/handlers/a.ts', '../db/a'],
    [
      'a directory named api inside the web',
      'apps/web/src/screens/a.tsx',
      '../../api/use-me',
    ],
    [
      'a file of the package root',
      'packages/api-contract/src/a.ts',
      '../openapi/a',
    ],
    ['a file next to it', 'packages/domain/src/a.ts', './b'],
    [
      'a name that begins with domain',
      'apps/web/src/screens/a.tsx',
      '../../lib/domain-functions',
    ],
  ])('lets %s through', async (_name, path, source) => {
    expect(await restricted(imports(source), path)).toHaveLength(0);
  });

  it.each([
    [
      'a test of packages/domain',
      'packages/domain/src/a.test.ts',
      '../../application/src/a',
    ],
    [
      'testing.ts of packages/domain',
      'packages/domain/src/testing.ts',
      '../../application/src/a',
    ],
    [
      'a test of services/api',
      'services/api/src/a.test.ts',
      '../../../apps/web/src/a',
    ],
    [
      'a test of apps/web',
      'apps/web/src/screens/a.test.tsx',
      '../../../../packages/domain/src/a',
    ],
    [
      'the test helpers of apps/web',
      'apps/web/src/test/a.ts',
      '../../../../packages/domain/src/a',
    ],
  ])('does not look at %s', async (_name, path, source) => {
    expect(await restricted(imports(source), path)).toHaveLength(0);
  });
});

describe('src/screen-data/ importing the screens', () => {
  it.each([
    ['@/screens', 'apps/web/src/screen-data/a.ts', '@/screens/backlog/a'],
    ['@/screens itself', 'apps/web/src/screen-data/a.ts', '@/screens'],
    ['../screens', 'apps/web/src/screen-data/a.ts', '../screens/backlog/a'],
    [
      '../../screens, from a subdirectory',
      'apps/web/src/screen-data/sub/a.ts',
      '../../screens/a',
    ],
    ['in a .tsx file', 'apps/web/src/screen-data/a.tsx', '@/screens/a'],
  ])('stops %s', async (_name, path, source) => {
    expect(await restricted(imports(source), path)).not.toHaveLength(0);
  });

  it.each([
    ['the api layer', 'apps/web/src/screen-data/a.ts', '@/api/use-me'],
    ['a file next to it', 'apps/web/src/screen-data/a.ts', './b'],
    [
      'the screens importing screen-data',
      'apps/web/src/screens/a.tsx',
      '@/screen-data/use-today',
    ],
    [
      'the screens importing it by a relative path',
      'apps/web/src/screens/a.tsx',
      '../../screen-data/use-today',
    ],
    [
      'a screen importing another screen',
      'apps/web/src/screens/a/b.tsx',
      '../c/d',
    ],
    [
      'a test of screen-data',
      'apps/web/src/screen-data/a.test.ts',
      '@/screens/backlog/a',
    ],
  ])('lets %s through', async (_name, path, source) => {
    expect(await restricted(imports(source), path)).toHaveLength(0);
  });

  it('keeps the rules of the domain and of Better Auth for these files', async () => {
    const path = 'apps/web/src/screen-data/a.ts';
    expect(await restricted(imports('@itera/domain'), path)).not.toHaveLength(
      0,
    );
    expect(await restricted(imports('better-auth'), path)).not.toHaveLength(0);
  });
});

describe('@itera/api-contract/requests in apps/web', () => {
  it.each([
    ['screens', 'apps/web/src/screens/a.tsx'],
    ['screen-data', 'apps/web/src/screen-data/a.ts'],
    ['components', 'apps/web/src/components/a.tsx'],
    ['lib/domain-functions.ts', 'apps/web/src/lib/domain-functions.ts'],
    ['auth/better-auth.ts', 'apps/web/src/auth/better-auth.ts'],
  ])('is stopped in %s', async (_name, path) => {
    expect(
      await restricted(imports('@itera/api-contract/requests'), path),
    ).not.toHaveLength(0);
  });

  it('is the browser mock that uses it', async () => {
    expect(
      await restricted(
        imports('@itera/api-contract/requests'),
        'apps/web/src/mock/a.ts',
      ),
    ).toHaveLength(0);
  });
});
