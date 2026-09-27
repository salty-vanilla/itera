// Regression cases for session-env.sh. A fake direnv and node keep the cases
// independent of the machine. Run with: pnpm agent:hooks:test
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const hook = fileURLToPath(new URL('./session-env.sh', import.meta.url));

let dir;
let bin;
let envFile;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'session-env-'));
  bin = join(dir, 'bin');
  envFile = join(dir, 'claude-env');
  mkdirSync(bin);
  writeFileSync(join(dir, '.envrc'), '');
  writeFileSync(join(dir, '.node-version'), '26\n');
  writeFileSync(envFile, '');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const tool = (name, body) => {
  const path = join(bin, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
};

// Only the fake bin and the system directories are on PATH, so the host's
// direnv and node are never used.
const run = (env = {}) => {
  const result = spawnSync('/bin/bash', [hook], {
    encoding: 'utf8',
    env: {
      PATH: `${bin}:/usr/bin:/bin`,
      CLAUDE_PROJECT_DIR: dir,
      CLAUDE_ENV_FILE: envFile,
      ...env,
    },
  });
  return {
    status: result.status,
    message: result.stdout ? JSON.parse(result.stdout).systemMessage : '',
    appended: readFileSync(envFile, 'utf8'),
  };
};

describe('session-env.sh', () => {
  it('appends the direnv exports when they select the pinned Node', () => {
    tool('direnv', `echo "export PATH='${bin}/pinned:$PATH'"`);
    mkdirSync(join(bin, 'pinned'));
    const node = join(bin, 'pinned', 'node');
    writeFileSync(node, '#!/bin/sh\necho v26.8.1\n');
    chmodSync(node, 0o755);

    const result = run();
    expect(result).toMatchObject({ status: 0, message: '' });
    expect(result.appended).toContain(`${bin}/pinned`);
  });

  it('appends the full exports even when direnv state is inherited', () => {
    // Real direnv prints nothing when DIRENV_DIFF says the .envrc is loaded.
    tool('direnv', '[ -n "$DIRENV_DIFF" ] || echo "export ITERA_TEST=1"');
    tool('node', 'echo v26.8.1');

    const result = run({ DIRENV_DIR: `-${dir}`, DIRENV_DIFF: 'loaded' });
    expect(result).toMatchObject({ status: 0, message: '' });
    expect(result.appended).toContain('ITERA_TEST');
  });

  it('reports a pnpm other than the pinned version', () => {
    writeFileSync(
      join(dir, 'package.json'),
      '{ "packageManager": "pnpm@10.32.1" }\n',
    );
    tool('direnv', 'echo "export ITERA_TEST=1"');
    tool('node', 'echo v26.8.1');
    tool('pnpm', 'echo 9.0.0');

    const result = run();
    expect(result.status).toBe(0);
    expect(result.message).toContain('pnpm 9.0.0');
  });

  it('reports a Node outside the pinned series without blocking', () => {
    tool('direnv', 'echo "export ITERA_TEST=1"');
    tool('node', 'echo v24.14.0');

    const result = run();
    expect(result.status).toBe(0);
    expect(result.message).toContain('Node v24.14.0');
    expect(result.appended).toContain('ITERA_TEST');
  });

  it('appends nothing and reports when .envrc is blocked', () => {
    tool('direnv', 'echo "export ITERA_UNLOAD=1"; exit 1');

    const result = run();
    expect(result.status).toBe(0);
    expect(result.message).toContain('direnv allow');
    expect(result.appended).toBe('');
  });

  it('reports when direnv is missing', () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.message).toContain('direnv was not found');
    expect(result.appended).toBe('');
  });

  it('does nothing outside a SessionStart environment file', () => {
    const result = spawnSync('/bin/bash', [hook], {
      encoding: 'utf8',
      env: { PATH: '/usr/bin:/bin', CLAUDE_PROJECT_DIR: dir },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});
