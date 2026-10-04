// Helpers for tooling tests that run a script against a throwaway directory.
import { createHash } from 'node:crypto';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// realpath: on macOS tmpdir() is behind a symlink, which would make a child's
// `pwd` differ from the path the test created.
export function makeTempDir(prefix) {
  return realpathSync(mkdtempSync(join(tmpdir(), `${prefix}-`)));
}

export function removeTempDir(directory) {
  rmSync(directory, { recursive: true, force: true });
}

export function writeFile(path, content, mode) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  if (mode !== undefined) chmodSync(path, mode);
}

export const writeExecutable = (path, content) =>
  writeFile(path, content, 0o755);

// A parent environment without Git's own variables (a test may itself run
// inside a Git hook) and without the user's Git configuration.
export function cleanGitEnv(extra = {}) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  return {
    ...env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    ...extra,
  };
}
