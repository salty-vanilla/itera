// Every enum of the contract says whether it is open or closed (ADR 0006
// 列挙, #352): `Closed enum.` or `Open enum.` starts its description. So does
// the `oneOf` of error bodies, which the ADR treats as an open enum. Without
// it, a change that adds a value cannot be told from a breaking one by
// reading the contract.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const KIND = /^(Closed|Open) enum\./;

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A place in the bundled contract where a kind is required. */
type Place = { readonly path: string; readonly node: Node };

/**
 * The schemas that have an `enum`, and the `oneOf` whose branches are all
 * error bodies (a reference to a schema named `…Error`).
 */
function places(root: unknown): { enums: Place[]; errorUnions: Place[] } {
  const enums: Place[] = [];
  const errorUnions: Place[] = [];
  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}/${i}`));
      return;
    }
    if (!isNode(value)) return;
    if (Array.isArray(value['enum'])) enums.push({ path, node: value });
    const branches = value['oneOf'];
    if (
      Array.isArray(branches) &&
      branches.length > 0 &&
      branches.every(
        (branch) =>
          isNode(branch) &&
          typeof branch['$ref'] === 'string' &&
          /Error$/.test(branch['$ref']),
      )
    )
      errorUnions.push({ path, node: value });
    for (const [key, child] of Object.entries(value))
      walk(child, `${path}/${key}`);
  };
  walk(root, '#');
  return { enums, errorUnions };
}

describe('the contract’s enums', () => {
  let dir: string;
  let found: ReturnType<typeof places>;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'itera-enum-kinds-'));
    const output = join(dir, 'openapi.json');
    // The bundle has every schema in one file, so the walk does not follow
    // references. `redocly` is the lint's own tool (no new dependency).
    execFileSync(
      join(packageDir, 'node_modules', '.bin', 'redocly'),
      ['bundle', 'openapi/openapi.yaml', '--ext', 'json', '--output', output],
      {
        cwd: packageDir,
        stdio: 'pipe',
        env: { ...process.env, REDOCLY_SUPPRESS_UPDATE_NOTICE: 'true' },
      },
    );
    found = places(JSON.parse(await readFile(output, 'utf8')));
  }, 60_000);

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('are found (the walk is not empty)', () => {
    // 35 `enum`s and the one `oneOf` of error bodies when #352 was made. A
    // contract with none means the walk is broken, not that it is done.
    expect(found.enums).toHaveLength(35);
    expect(found.errorUnions.length).toBeGreaterThanOrEqual(1);
  });

  it('say whether each is open or closed', () => {
    const missing = [...found.enums, ...found.errorUnions]
      .filter(({ node }) => !KIND.test(String(node['description'] ?? '')))
      .map(({ path }) => path);
    expect(
      missing,
      'start the description with `Closed enum.` or `Open enum.` (ADR 0006 列挙)',
    ).toEqual([]);
  });

  it('keep the error bodies open', () => {
    // ADR 0006: the error `type` is the open enum. A `type` that is an
    // `enum` (RuleViolationError) and the `oneOf` of the bodies are open.
    const errorTypes = found.enums.filter(({ path }) =>
      /\/[A-Za-z]+Error\/properties\/type$/.test(path),
    );
    expect(errorTypes.length).toBeGreaterThanOrEqual(1);
    for (const { path, node } of [...errorTypes, ...found.errorUnions])
      expect(String(node['description']), path).toMatch(/^Open enum\./);
  });
});
