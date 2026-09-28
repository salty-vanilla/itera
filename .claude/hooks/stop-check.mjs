// Stop hook: run `pnpm check` before Claude finishes a response, but only when
// the working tree holds changes that have not been checked yet. The hook fires
// after every response (explanations included), so everything else is skipped:
// - `stop_hook_active`: this stop follows a block from this hook;
// - no changes against HEAD, or only Markdown outside DESIGN.md and .agents/
//   (Prettier ignores *.md; DESIGN.md and .agents/ have their own checks);
// - the same working tree was already checked (pass or fail), recorded as a
//   fingerprint in .tools/hooks/ (local, not in Git).
// A failing check blocks the stop once and hands the output tail to Claude.
// Environment problems (no pinned Node) are reported without blocking.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const git = (root, ...args) => {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'buffer',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed`);
  return result.stdout;
};
const list = (buffer) => buffer.toString('utf8').split('\0').filter(Boolean);

const untracked = (root) =>
  list(git(root, 'ls-files', '--others', '--exclude-standard', '-z'));

/** Tracked files changed against HEAD, plus untracked files not ignored. */
export function changedFiles(root) {
  return [
    ...new Set([
      ...list(git(root, 'diff', 'HEAD', '--name-only', '-z')),
      ...untracked(root),
    ]),
  ].sort();
}

/** Identifies HEAD plus every uncommitted change, untracked content included. */
export function fingerprint(root) {
  const hash = createHash('sha256');
  hash.update(git(root, 'rev-parse', 'HEAD'));
  hash.update(git(root, 'diff', 'HEAD', '--binary', '--no-ext-diff'));
  for (const file of untracked(root)) {
    hash.update(`\0${file}\0`);
    try {
      hash.update(readFileSync(join(root, file)));
    } catch {
      hash.update('unreadable');
    }
  }
  return hash.digest('hex');
}

/**
 * Returns the reason to skip the check, or null to run it.
 * @param {{ stopHookActive: boolean, files: string[], current: string, last?: { fingerprint?: string } }} state
 */
export function skipReason({ stopHookActive, files, current, last }) {
  if (stopHookActive) return 'stop_hook_active';
  if (files.length === 0) return 'no changes';
  if (
    files.every(
      (file) =>
        file.endsWith('.md') &&
        file !== 'DESIGN.md' &&
        !file.startsWith('.agents/'),
    )
  )
    return 'Markdown only';
  if (last?.fingerprint === current) return 'already checked';
  return null;
}

// direnv's shell hook does not run for hook commands, so load .envrc the same
// way session-env.sh does for Bash. Without direnv, use PATH as it is.
function command(root, ...args) {
  const direnv = spawnSync('direnv', ['version'], { stdio: 'ignore' });
  return direnv.status === 0 ? ['direnv', 'exec', root, ...args] : args;
}

function defaultRun(root) {
  const expected = readFileSync(join(root, '.node-version'), 'utf8').trim();
  const [probe, ...probeArgs] = command(root, 'node', '--version');
  const node = spawnSync(probe, probeArgs, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, DIRENV_LOG_FORMAT: '' },
  });
  const actual = node.status === 0 ? node.stdout.trim() : '';
  if (actual !== `v${expected}` && !actual.startsWith(`v${expected}.`))
    return { environment: `Node ${actual || 'not found'}, need ${expected}` };

  // One stream keeps the failing step's messages in order at the end.
  const [bin, ...args] = command(root, 'sh', '-c', 'exec pnpm check 2>&1');
  const result = spawnSync(bin, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, DIRENV_LOG_FORMAT: '' },
  });
  if (result.error) return { environment: result.error.message };
  return { passed: result.status === 0, output: result.stdout ?? '' };
}

const tail = (text, lines = 60) =>
  text
    .replace(/\x1b\[[0-9;]*m/g, '') // eslint-disable-line no-control-regex
    .trimEnd()
    .split('\n')
    .slice(-lines)
    .join('\n');

/** Decides and runs; returns the hook's stdout object, or null for none. */
export function main({ input, root, run = defaultRun }) {
  const statePath = join(root, '.tools/hooks/stop-check.json');
  let files;
  try {
    files = changedFiles(root);
  } catch {
    return null; // Not a Git work tree, or no commit yet.
  }
  const current = files.length ? fingerprint(root) : '';
  let last;
  try {
    last = JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    last = undefined;
  }
  if (
    skipReason({
      stopHookActive: input.stop_hook_active === true,
      files,
      current,
      last,
    })
  )
    return null;

  const result = run(root);
  if (result.environment)
    return {
      systemMessage: `Stop hook skipped pnpm check: ${result.environment}. Check Devbox and .envrc.`,
    };
  mkdirSync(join(root, '.tools/hooks'), { recursive: true });
  writeFileSync(
    statePath,
    `${JSON.stringify({ fingerprint: current, passed: result.passed, at: new Date().toISOString() })}\n`,
  );
  if (result.passed) return null;
  return {
    decision: 'block',
    reason: `pnpm check failed on the current changes. Fix them, or tell the user why they stay. Output (last lines):\n${tail(result.output)}`,
  };
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    // Treat unreadable input as a plain stop.
  }
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const output = main({ input, root });
  if (output) process.stdout.write(`${JSON.stringify(output)}\n`);
}
