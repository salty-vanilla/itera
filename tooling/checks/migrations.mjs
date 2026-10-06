import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// drizzle-kit prints this and writes nothing when the schema and the latest
// snapshot agree. Matching the message fails closed: if a drizzle-kit upgrade
// changes it, the check fails and has to be looked at.
const noChanges = 'No schema changes, nothing to migrate';

const drizzleTimeoutMs = 60_000;

// `before` and `after` are the sorted file lists of the migrations directory
// before and after `drizzle-kit generate` ran on a copy. Returns the reason
// the check fails, or null when schema.ts and migrations/ agree.
export function findDrift({ before, after, status, output }) {
  const added = after.filter((file) => !before.includes(file));
  if (added.length > 0) {
    return [
      'src/db/schema.ts has changes that no migration in migrations/ covers.',
      `drizzle-kit would generate: ${added.join(', ')}`,
      'Run `pnpm --filter @itera/api db:generate`, review the new SQL, and commit it with the schema change.',
    ].join('\n');
  }
  if (status !== 0 || !output.includes(noChanges)) {
    return [
      'drizzle-kit generate did not report "No schema changes" and added no migration.',
      'Run `pnpm --filter @itera/api db:generate` to see what it says (it may ask about a renamed column or table).',
      `Exit status: ${status ?? 'none (timed out)'}`,
      `Output:\n${output}`,
    ].join('\n');
  }
  return null;
}

function listFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? listFiles(join(directory, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`],
    )
    .sort();
}

// Runs drizzle-kit on a copy of migrations/ in a temporary directory, so the
// working tree is never written. The temporary directory is the working
// directory because drizzle-kit joins its --out option onto "./", and an
// absolute --schema is the only form it accepts from there.
export function checkMigrations(packageDirectory) {
  const migrations = join(packageDirectory, 'migrations');
  const work = mkdtempSync(join(tmpdir(), 'itera-migrations-'));
  try {
    cpSync(migrations, join(work, 'migrations'), { recursive: true });
    const before = listFiles(join(work, 'migrations'));
    const result = spawnSync(
      'drizzle-kit',
      [
        'generate',
        '--dialect=sqlite',
        `--schema=${join(packageDirectory, 'src/db/schema.ts')}`,
        '--out=./migrations',
      ],
      {
        cwd: work,
        encoding: 'utf8',
        // No input: a rename question fails the check instead of waiting.
        input: '',
        timeout: drizzleTimeoutMs,
        env: { ...process.env, CI: 'true', NO_COLOR: '1' },
      },
    );
    const problem = findDrift({
      before,
      after: listFiles(join(work, 'migrations')),
      status: result.error ? null : result.status,
      output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error?.message ?? ''}`,
    });
    return problem;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  // Run from the package directory by `pnpm --filter @itera/api db:check`, so
  // node_modules/.bin (drizzle-kit) is on PATH.
  const problem = checkMigrations(process.cwd());
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  console.log('migrations/ matches src/db/schema.ts.');
}
