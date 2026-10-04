// tooling/with-node.sh, lefthook.sh and setup.sh in a throwaway project.
// with-node.sh finds .node-version and package.json next to itself, and every
// tool it probes is replaced by a fake found through PATH, so the machine's
// own Node and pnpm are never consulted.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  makeTempDir,
  removeTempDir,
  writeExecutable,
  writeFile,
} from './test-support.mjs';

const tooling = fileURLToPath(new URL('./', import.meta.url));
const pinned = '10.32.1';
const found = (name) =>
  spawnSync('sh', ['-c', `command -v ${name}`], {
    encoding: 'utf8',
  }).stdout.trim();
let dir;
let utilities;
let fakes;

function install(...names) {
  mkdirSync(join(dir, 'tooling'), { recursive: true });
  for (const name of names) {
    copyFileSync(join(tooling, name), join(dir, 'tooling', name));
  }
}

// The fake node reports FAKE_NODE_VERSION and otherwise behaves like the real
// one, because with-node.sh uses it to read package.json.
function fakeNode(directory) {
  writeExecutable(
    join(directory, 'node'),
    `#!/bin/sh
if [ "$1" = "--version" ]; then echo "$FAKE_NODE_VERSION"; exit 0; fi
exec "${process.execPath}" "$@"
`,
  );
}
function fakePnpm(directory) {
  writeExecutable(
    join(directory, 'pnpm'),
    `#!/bin/sh
if [ "$1" = "--version" ]; then echo "$FAKE_PNPM_VERSION"; exit 0; fi
echo "pnpm $*"
`,
  );
}

beforeEach(() => {
  dir = makeTempDir('with-node');
  // Only what the scripts call besides builtins, so nothing else leaks in.
  utilities = join(dir, 'utilities');
  fakes = join(dir, 'fakes');
  mkdirSync(utilities);
  mkdirSync(fakes);
  for (const name of ['bash', 'tr', 'dirname', 'cat']) {
    symlinkSync(found(name), join(utilities, name));
  }
  install('with-node.sh', 'lefthook.sh', 'setup.sh');
  writeFile(join(dir, '.node-version'), '26\n');
  writeFile(
    join(dir, 'package.json'),
    JSON.stringify({
      packageManager: `pnpm@${pinned}`,
      engines: { pnpm: pinned },
    }),
  );
});
afterEach(() => removeTempDir(dir));

function run(script, args, { path = [fakes], env = {}, cwd = dir } = {}) {
  const result = spawnSync(
    join(utilities, 'bash'),
    [join(dir, 'tooling', script), ...args],
    {
      cwd,
      encoding: 'utf8',
      env: {
        PATH: [...path, utilities].join(':'),
        FAKE_NODE_VERSION: 'v26.8.1',
        FAKE_PNPM_VERSION: pinned,
        FAKE_LOG: join(dir, 'log.txt'),
        ...env,
      },
    },
  );
  return { ...result, output: `${result.stdout}${result.stderr}` };
}
const withNode = (args, options) => run('with-node.sh', args, options);

describe('with-node.sh', () => {
  beforeEach(() => {
    fakeNode(fakes);
    fakePnpm(fakes);
    writeExecutable(
      join(fakes, 'probe'),
      '#!/bin/sh\nprintf "path=%s\\n" "$PATH"\nprintf "arg=%s\\n" "$@"\n',
    );
  });

  it('runs the command with its arguments when Node and pnpm match', () => {
    const result = withNode(['probe', 'a b', '--flag']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('arg=a b\narg=--flag\n');
  });

  it('exits with the status of the command', () => {
    writeExecutable(join(fakes, 'fail'), '#!/bin/sh\nexit 3\n');
    expect(withNode(['fail']).status).toBe(3);
  });

  it('needs a command', () => {
    const result = withNode([]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Runtime error: Usage: bash tooling/with-node.sh <command> [args...]',
    );
  });

  describe('ITERA_NODE_BIN', () => {
    let nodeBin;
    beforeEach(() => {
      nodeBin = join(dir, 'selected');
      mkdirSync(nodeBin);
      fakeNode(nodeBin);
    });

    it('puts the directory first on PATH and takes node from it', () => {
      // PATH has no node of its own, and no pnpm until the fake one is added.
      fakePnpm(nodeBin);
      writeExecutable(
        join(nodeBin, 'probe'),
        '#!/bin/sh\nprintf "path=%s\\n" "$PATH"\n',
      );
      const result = withNode(['probe'], {
        path: [],
        env: { ITERA_NODE_BIN: nodeBin },
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(new RegExp(`^path=${nodeBin}:`));
    });

    it('must be an absolute path', () => {
      const result = withNode(['probe'], {
        env: { ITERA_NODE_BIN: 'selected' },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'ITERA_NODE_BIN must be an absolute directory containing node.',
      );
    });

    it('cannot contain a colon', () => {
      const result = withNode(['probe'], {
        env: { ITERA_NODE_BIN: `${nodeBin}:${fakes}` },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('cannot contain a colon');
    });

    it('must contain a node file', () => {
      const empty = join(dir, 'empty');
      mkdirSync(empty);
      const result = withNode(['probe'], { env: { ITERA_NODE_BIN: empty } });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'ITERA_NODE_BIN must contain an executable node file.',
      );
    });

    it('must contain an executable node file', () => {
      const plain = join(dir, 'plain');
      writeFile(join(plain, 'node'), '#!/bin/sh\n', 0o644);
      const result = withNode(['probe'], { env: { ITERA_NODE_BIN: plain } });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('executable node file');
    });
  });

  it('reports a missing node', () => {
    const result = withNode(['probe'], { path: [] });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Runtime error: Node is missing.');
  });

  describe('Node series', () => {
    it.each(['v26.0.0', 'v26.8.1', 'v26'])(
      'accepts %s for series 26',
      (version) => {
        expect(
          withNode(['probe'], { env: { FAKE_NODE_VERSION: version } }).status,
        ).toBe(0);
      },
    );

    it.each(['v25.9.0', 'v27.0.0', 'v260.1.0', 'v2.6.0', '26.8.1'])(
      'rejects %s for series 26',
      (version) => {
        const result = withNode(['probe'], {
          env: { FAKE_NODE_VERSION: version },
        });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
          `Expected Node 26 series, found ${version}.`,
        );
        expect(result.stdout).toBe('');
      },
    );

    it('reads a series with a minor version, and ignores CRLF', () => {
      writeFile(join(dir, '.node-version'), '26.8\r\n');
      expect(
        withNode(['probe'], { env: { FAKE_NODE_VERSION: 'v26.8.3' } }).status,
      ).toBe(0);
      const result = withNode(['probe'], {
        env: { FAKE_NODE_VERSION: 'v26.9.0' },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'Expected Node 26.8 series, found v26.9.0.',
      );
    });
  });

  describe('pnpm version', () => {
    it('reports a missing pnpm with the version to install', () => {
      // A PATH that has node but no pnpm.
      const bare = join(dir, 'bare');
      mkdirSync(bare);
      fakeNode(bare);
      const result = withNode(['probe'], { path: [bare] });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        `pnpm is missing. Install pnpm ${pinned}`,
      );
    });

    it.each(['10.32.0', '10.33.1', '9.15.0', ''])(
      'rejects pnpm "%s"',
      (version) => {
        const result = withNode(['probe'], {
          env: { FAKE_PNPM_VERSION: version },
        });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(
          `Expected pnpm ${pinned}, found ${version}.`,
        );
        expect(result.stdout).toBe('');
      },
    );

    it.each([
      [
        'differ',
        { packageManager: `pnpm@${pinned}`, engines: { pnpm: '10.0.0' } },
      ],
      [
        'are a range',
        { packageManager: `pnpm@^${pinned}`, engines: { pnpm: `^${pinned}` } },
      ],
      [
        'name another manager',
        { packageManager: `yarn@${pinned}`, engines: { pnpm: pinned } },
      ],
      ['are missing', {}],
    ])('rejects a package.json whose pnpm pins %s', (_, pkg) => {
      writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
      const result = withNode(['probe']);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'packageManager and engines.pnpm must specify the same exact pnpm version.',
      );
      expect(result.stdout).toBe('');
    });
  });
});

// Both scripts run lefthook / setup steps through with-node.sh. A stub records
// how it was called, so only their own decisions are tested.
describe('lefthook.sh', () => {
  beforeEach(() => {
    writeExecutable(
      join(dir, 'tooling/with-node.sh'),
      '#!/usr/bin/env bash\necho "with-node cwd=$PWD args=$*" >> "$FAKE_LOG"\n',
    );
  });
  const log = () => readFileSync(join(dir, 'log.txt'), 'utf8');

  it('runs this checkout lefthook through with-node.sh from the project root', () => {
    const result = run('lefthook.sh', ['run', 'pre-commit'], {
      cwd: join(dir, 'tooling'),
    });
    expect(result.status).toBe(0);
    expect(log()).toBe(
      `with-node cwd=${dir} args=pnpm exec lefthook run pre-commit\n`,
    );
  });

  it('loads the direnv environment when direnv is installed', () => {
    writeExecutable(
      join(fakes, 'direnv'),
      '#!/bin/sh\necho "direnv $*" >> "$FAKE_LOG"\nshift 2\nexec "$@"\n',
    );
    const result = run('lefthook.sh', ['install']);
    expect(result.status).toBe(0);
    expect(log()).toBe(
      'direnv exec . bash tooling/with-node.sh pnpm exec lefthook install\n' +
        `with-node cwd=${dir} args=pnpm exec lefthook install\n`,
    );
  });

  it('exits with the status of lefthook', () => {
    writeExecutable(
      join(dir, 'tooling/with-node.sh'),
      '#!/usr/bin/env bash\nexit 4\n',
    );
    expect(run('lefthook.sh', []).status).toBe(4);
  });
});

describe('setup.sh', () => {
  beforeEach(() => {
    writeExecutable(
      join(dir, 'tooling/with-node.sh'),
      `#!/usr/bin/env bash
echo "cwd=$PWD $*" >> "$FAKE_LOG"
[ "$*" = "$FAKE_FAIL_ON" ] && exit 1
exit 0
`,
    );
  });
  const log = () =>
    existsSync(join(dir, 'log.txt'))
      ? readFileSync(join(dir, 'log.txt'), 'utf8')
      : '';
  const steps = [
    'pnpm install --frozen-lockfile',
    'pnpm exec lefthook install',
    'pnpm agent:setup',
    'pnpm agent:browser:install',
  ];

  it('runs every step through with-node.sh from the project root', () => {
    const result = run('setup.sh', [], { cwd: join(dir, 'tooling') });
    expect(result.status).toBe(0);
    expect(log()).toBe(steps.map((step) => `cwd=${dir} ${step}\n`).join(''));
    expect(result.stdout).toContain('Setup complete.');
  });

  it('only warns when the browser cannot be installed', () => {
    const result = run('setup.sh', [], {
      env: { FAKE_FAIL_ON: 'pnpm agent:browser:install' },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      'Warning: could not install the Agent browser. Retry with: pnpm agent:browser:install',
    );
    expect(result.stdout).toContain('Setup complete.');
  });

  it.each(steps.slice(0, 3).map((step, index) => [step, index]))(
    'stops at the first failing step: %s',
    (step, index) => {
      const result = run('setup.sh', [], { env: { FAKE_FAIL_ON: step } });
      expect(result.status).toBe(1);
      expect(log().trim().split('\n')).toHaveLength(index + 1);
      expect(result.stdout).not.toContain('Setup complete.');
    },
  );
});
