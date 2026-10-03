// Writes the generated code (`write`) or checks that the committed code is
// what the contract generates now (`check`, run by `pnpm check`). Redocly
// bundles openapi/ into one file first; Hey API generates from that.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createClient } from '@hey-api/openapi-ts';
import { OUTPUT, contractConfig } from '../openapi-ts.config.ts';

/** @param {string} dir */
async function files(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .toSorted();
}

/** @param {string} dir @param {string} output */
async function generate(dir, output) {
  const bundle = join(dir, 'openapi.yaml');
  execFileSync(
    join('node_modules', '.bin', 'redocly'),
    ['bundle', 'openapi/openapi.yaml', '--output', bundle],
    {
      stdio: ['ignore', 'ignore', 'inherit'],
      env: { ...process.env, REDOCLY_SUPPRESS_UPDATE_NOTICE: 'true' },
    },
  );
  await createClient(contractConfig(bundle, output));
  // Hey API's fetch runtime (client/, core/) is copied as it is and is not
  // written for exactOptionalPropertyTypes, with which apps/web compiles
  // these sources. Its types are not the contract's; the code generated
  // from the contract (types, schemas, SDK, queries) stays checked.
  for (const file of await files(output)) {
    if (!/^(client|core)[/\\]/.test(file)) continue;
    const path = join(output, file);
    await writeFile(path, `// @ts-nocheck\n${await readFile(path, 'utf8')}`);
  }
}

/** @param {string} actual @param {string} expected */
async function differences(actual, expected) {
  const [want, have] = await Promise.all([files(expected), files(actual)]);
  const found = [
    ...want.filter((f) => !have.includes(f)).map((f) => `missing ${f}`),
    ...have.filter((f) => !want.includes(f)).map((f) => `extra ${f}`),
  ];
  for (const file of want.filter((f) => have.includes(f))) {
    const [a, b] = await Promise.all([
      readFile(join(expected, file), 'utf8'),
      readFile(join(actual, file), 'utf8'),
    ]);
    if (a !== b) found.push(`changed ${file}`);
  }
  return found;
}

const mode = process.argv[2];
if (mode !== 'write' && mode !== 'check') {
  console.error('Usage: node scripts/generated.mjs write|check');
  process.exit(2);
}
const work = await mkdtemp(join(tmpdir(), 'itera-contract-'));
try {
  if (mode === 'write') {
    await generate(work, OUTPUT);
  } else {
    const fresh = join(work, 'generated');
    await generate(work, fresh);
    const found = await differences(OUTPUT, fresh);
    if (found.length > 0) {
      console.error(
        `${OUTPUT} is not what openapi/ generates:\n  ${found.join('\n  ')}\n` +
          'Run `pnpm contract:generate` and commit the result.',
      );
      process.exitCode = 1;
    } else {
      console.log(`${OUTPUT} matches openapi/.`);
    }
  }
} finally {
  await rm(work, { recursive: true, force: true });
}
