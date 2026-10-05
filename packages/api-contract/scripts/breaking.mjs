// Compares the contract with the one at a base commit (ADR 0006 「互換の規則」,
// Issue #367). Redocly bundles both into one file, oasdiff finds the
// breaking changes between them, and breaking-rules.mjs applies the rules
// of ADR 0006 that oasdiff does not know and checks `info.version`. CI runs
// it on each pull request against the base branch.
//
//   node scripts/breaking.mjs [--base <git ref>] [--warn-only]
//
// It compares with where this branch left the base (`git merge-base`), so
// what the base gained since is not taken for a change here. CI passes the
// first parent of the pull request's merge commit, which is that point.
//
// oasdiff is the release binary pinned below, downloaded once into
// .tools/oasdiff/ and checked against its SHA-256 (ADR 0006 「道具と版」).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  appendFile,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { LEVELS, assess, untitledBranches } from './breaking-rules.mjs';

const OASDIFF = {
  version: '1.33.0',
  /** @type {Record<string, { file: string, sha256: string }>} */
  assets: {
    'darwin-arm64': {
      file: 'oasdiff_1.33.0_darwin_all.tar.gz',
      sha256:
        '2a479337c15afdcbf0b1e89c0b4d0cf0176472dbc11483358fed1f831d1e46c5',
    },
    'darwin-x64': {
      file: 'oasdiff_1.33.0_darwin_all.tar.gz',
      sha256:
        '2a479337c15afdcbf0b1e89c0b4d0cf0176472dbc11483358fed1f831d1e46c5',
    },
    'linux-x64': {
      file: 'oasdiff_1.33.0_linux_amd64.tar.gz',
      sha256:
        '43a4e328e2d13ba1552d760aa68d2485c75c5621f309f6ff64ae895188345247',
    },
    'linux-arm64': {
      file: 'oasdiff_1.33.0_linux_arm64.tar.gz',
      sha256:
        '4ae3c362d6074d919aada2dea82d0ee84366591600384455d0bdc658ddf8f7ae',
    },
  },
};

const PACKAGE = join(import.meta.dirname, '..');
const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: PACKAGE,
  encoding: 'utf8',
}).trim();
const REDOCLY = join(PACKAGE, 'node_modules', '.bin', 'redocly');

/** The pinned oasdiff, downloaded on first use. */
async function oasdiff() {
  const platform = `${process.platform}-${process.arch}`;
  const asset = OASDIFF.assets[platform];
  if (!asset) throw new Error(`oasdiff is not pinned for ${platform}.`);
  const directory = join(ROOT, '.tools', 'oasdiff', OASDIFF.version, platform);
  const binary = join(directory, 'oasdiff');
  if (existsSync(binary)) return binary;
  const url = `https://github.com/oasdiff/oasdiff/releases/download/v${OASDIFF.version}/${asset.file}`;
  const bytes = await download(url);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== asset.sha256) {
    throw new Error(`${asset.file} does not match its pinned SHA-256.`);
  }
  await mkdir(dirname(directory), { recursive: true });
  const staging = await mkdtemp(join(dirname(directory), '.download-'));
  try {
    await writeFile(join(staging, asset.file), bytes);
    execFileSync('tar', ['-xzf', asset.file, 'oasdiff'], { cwd: staging });
    await chmod(join(staging, 'oasdiff'), 0o755);
    await rm(join(staging, asset.file));
    await rename(staging, directory).catch((error) => {
      // Another run put it there first.
      if (!existsSync(binary)) throw error;
    });
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return binary;
}

/** @param {string} url */
async function download(url) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url).catch(() => undefined);
    if (response?.ok) return Buffer.from(await response.arrayBuffer());
    if (attempt === 3) throw new Error(`Could not download ${url}.`);
  }
}

/** @param {string} packageDir @param {string} output */
function bundle(packageDir, output) {
  execFileSync(
    REDOCLY,
    ['bundle', 'openapi/openapi.yaml', '--ext', 'json', '--output', output],
    {
      cwd: packageDir,
      // Redocly reports its progress on stderr; a failure still shows it,
      // in the error that execFileSync throws.
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, REDOCLY_SUPPRESS_UPDATE_NOTICE: 'true' },
    },
  );
}

/** The contract at `ref`, written out of git into `work`. */
function checkoutBase(/** @type {string} */ ref, /** @type {string} */ work) {
  const where = 'packages/api-contract';
  const archive = execFileSync(
    'git',
    ['archive', ref, '--', `${where}/openapi`, `${where}/redocly.yaml`],
    { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 },
  );
  execFileSync('tar', ['-x', '-C', work], { input: archive });
  return join(work, where);
}

/** A message as a GitHub Actions workflow command's value. */
function escaped(/** @type {string} */ message) {
  return message
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

/** @param {import('./breaking-rules.mjs').Change[]} changes */
function grouped(changes) {
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  for (const change of changes) {
    const key = `${change.text} [${change.id}]`;
    groups.set(key, [
      ...(groups.get(key) ?? []),
      `${change.operation ?? ''} ${change.path ?? ''}`.trim(),
    ]);
  }
  return [...groups].map(([key, operations]) =>
    operations.length === 1
      ? `${operations[0]}: ${key}`
      : `${key} (${operations.length} operations, e.g. ${operations[0]})`,
  );
}

const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'origin/main' },
    'warn-only': { type: 'boolean', default: false },
  },
});
if (values.base.startsWith('-')) {
  throw new Error(`Not a git ref: ${values.base}`);
}
const base = execFileSync('git', ['merge-base', values.base, 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
const warnOnly = values['warn-only'];
const inActions = process.env['GITHUB_ACTIONS'] === 'true';

const work = await mkdtemp(join(tmpdir(), 'itera-breaking-'));
try {
  const tool = await oasdiff();
  const headFile = join(work, 'head.json');
  const baseFile = join(work, 'base.json');
  bundle(PACKAGE, headFile);
  bundle(checkoutBase(base, work), baseFile);
  const levels = join(work, 'levels.txt');
  await writeFile(levels, `${LEVELS}\n`);
  const headSpec = JSON.parse(await readFile(headFile, 'utf8'));
  const baseSpec = JSON.parse(await readFile(baseFile, 'utf8'));
  const output = execFileSync(
    tool,
    [
      'breaking',
      baseFile,
      headFile,
      '--format',
      'json',
      '--flatten-allof',
      '--severity-levels',
      levels,
      '--allow-external-refs=false',
    ],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  const result = assess({
    changes: JSON.parse(output || '[]'),
    base: baseSpec.info.version,
    head: headSpec.info.version,
  });
  const problems = [
    ...result.problems,
    ...untitledBranches(headSpec).map(
      (pointer) =>
        `Give each inline object branch at ${pointer} a title, so that ` +
        'oasdiff compares the branches instead of reporting them as ' +
        'removed and added.',
    ),
  ];

  const sections = [
    [`Breaking changes (ADR 0006): ${result.breaking.length}`, result.breaking],
    [
      `Values added to an open enum, not breaking (ADR 0006 「列挙」): ${result.open.length}`,
      result.open,
    ],
    [
      `Changes oasdiff could not decide, to judge by hand: ${result.potential.length}`,
      result.potential,
    ],
  ];
  const lines = [
    `The contract compared with ${values.base} at ${base.slice(0, 12)}, where this branch left it: info.version ${baseSpec.info.version} → ${headSpec.info.version}.`,
    ...sections.flatMap(([title, changes]) => [
      '',
      /** @type {string} */ (title),
      ...grouped(
        /** @type {import('./breaking-rules.mjs').Change[]} */ (changes),
      ).map((line) => `  ${line}`),
    ]),
    '',
    'A change of meaning with the same shape (ADR 0006 「壊す変更」) is not ' +
      'found here; the review judges it.',
  ];
  console.log(lines.join('\n'));
  for (const problem of problems) {
    console.error(`\n${warnOnly ? 'Warning' : 'Error'}: ${problem}`);
    if (inActions) {
      console.log(
        `::${warnOnly ? 'warning' : 'error'} title=API contract::${escaped(problem)}`,
      );
    }
  }
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (inActions && summary) {
    await appendFile(
      summary,
      [
        '## API contract (ADR 0006)',
        '',
        ...problems.map((p) => `- **${warnOnly ? 'Warning' : 'Error'}:** ${p}`),
        '',
        '```',
        ...lines,
        '```',
        '',
      ].join('\n'),
    );
  }
  if (problems.length > 0 && !warnOnly) process.exitCode = 1;
} finally {
  await rm(work, { recursive: true, force: true });
}
