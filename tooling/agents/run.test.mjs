// agent:* runner: which executable runs, with which environment, and what
// happens when it is missing or fails. The tools are fakes that print their
// surroundings.
import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAgentProject, platform } from './fixture.mjs';

let project;

const probe = `#!/bin/sh
echo "args=$*"
echo "cwd=$(pwd)"
echo "path=$PATH"
echo "browsers=$PLAYWRIGHT_BROWSERS_PATH"
echo "ca=$NODE_EXTRA_CA_CERTS"
echo "notifier=$NO_UPDATE_NOTIFIER"
echo "impeccable_home=$IMPECCABLE_HOME"
echo "impeccable_skill=$IMPECCABLE_SKILL_DIR"
echo "impeccable_self=$IMPECCABLE_SELF"
exit "\${FAKE_EXIT:-0}"
`;
const lines = (result) =>
  Object.fromEntries(
    result.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => [
        line.slice(0, line.indexOf('=')),
        line.slice(line.indexOf('=') + 1),
      ]),
  );
const nodeBin = (name) => `tooling/agents/node_modules/.bin/${name}`;

beforeEach(() => {
  project = createAgentProject({
    manifest: {
      binaries: {
        impeccable: {
          version: '9.9.9',
          assets: {
            [platform]: { url: 'https://example.invalid/x', sha256: '' },
          },
        },
      },
    },
  });
  for (const name of ['shadcn', 'playwright-cli']) {
    project.write(nodeBin(name), probe);
    chmodSync(project.file(nodeBin(name)), 0o755);
  }
});
afterEach(() => project.cleanup());

describe('agent runner', () => {
  it.each([[['nope']], [[]]])('rejects an unknown tool: %j', (args) => {
    const result = project.run('run', args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown agent tool');
  });

  it('tells the user to run setup when the tool is not installed', () => {
    const result = project.run('run', ['impeccable']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Agent tools are not installed');
  });

  it('runs shadcn from the caller directory with the project tools first on PATH', () => {
    const elsewhere = project.file('apps/web');
    project.write('apps/web/.keep', '');
    const result = project.run('run', ['shadcn', 'info', '--json'], {
      cwd: elsewhere,
    });
    const seen = lines(result);
    expect(result.status).toBe(0);
    expect(seen.args).toBe('info --json');
    expect(seen.cwd).toBe(elsewhere);
    expect(seen.path.startsWith(`${project.cache}:`)).toBe(true);
    expect(seen.notifier).toBe('1');
  });

  it('runs playwright-cli from the project root with the shared browser cache', () => {
    const result = project.run('run', ['playwright', '-s=i374', 'open'], {
      cwd: project.file('tooling'),
    });
    const seen = lines(result);
    expect(seen.args).toBe('-s=i374 open');
    expect(seen.cwd).toBe(project.dir);
    expect(seen.browsers).toBe(
      process.platform === 'darwin'
        ? join(project.dir, 'Library/Caches/itera/ms-playwright')
        : join(project.dir, '.cache/itera/ms-playwright'),
    );
  });

  it('lets PLAYWRIGHT_BROWSERS_PATH override the shared browser cache', () => {
    const result = project.run('run', ['playwright'], {
      env: { PLAYWRIGHT_BROWSERS_PATH: '/somewhere/else' },
    });
    expect(lines(result).browsers).toBe('/somewhere/else');
  });

  it('installs Chromium for browser-install whatever arguments follow', () => {
    const result = project.run('run', ['browser-install', 'firefox']);
    expect(lines(result).args).toBe('install-browser chromium');
  });

  it('runs the pinned impeccable engine with its home and skill directory', () => {
    const engine = join(
      project.cache,
      'impeccable/9.9.9',
      platform,
      'impeccable',
    );
    project.write(
      join('.tools/agents/impeccable/9.9.9', platform, 'impeccable'),
      probe,
    );
    chmodSync(engine, 0o755);
    const result = project.run('run', ['impeccable', 'detect']);
    const seen = lines(result);
    expect(result.status).toBe(0);
    expect(seen.args).toBe('detect');
    expect(seen.impeccable_home).toBe(join(project.cache, 'impeccable-home'));
    expect(seen.impeccable_skill).toBe(
      project.file('.agents/skills/impeccable'),
    );
    expect(seen.impeccable_self).toBe('pnpm agent:impeccable');
  });

  it('fails on a platform without an impeccable engine', () => {
    project.write(
      'tooling/agents/sources.json',
      JSON.stringify({
        binaries: { impeccable: { version: '9.9.9', assets: {} } },
      }),
    );
    const result = project.run('run', ['impeccable']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Unsupported platform ${platform}`);
  });

  it('points Node at SSL_CERT_FILE only when NODE_EXTRA_CA_CERTS is unset', () => {
    const fallback = project.run('run', ['shadcn'], {
      env: { SSL_CERT_FILE: '/certs/a.pem' },
    });
    expect(lines(fallback).ca).toBe('/certs/a.pem');
    const explicit = project.run('run', ['shadcn'], {
      env: {
        SSL_CERT_FILE: '/certs/a.pem',
        NODE_EXTRA_CA_CERTS: '/certs/b.pem',
      },
    });
    expect(lines(explicit).ca).toBe('/certs/b.pem');
    expect(lines(project.run('run', ['shadcn'])).ca).toBe('');
  });

  it('exits with the tool exit code', () => {
    const result = project.run('run', ['shadcn'], { env: { FAKE_EXIT: '7' } });
    expect(result.status).toBe(7);
  });

  it('exits 1 when the tool is killed by a signal', () => {
    project.write(nodeBin('shadcn'), '#!/bin/sh\nkill -TERM $$\n');
    chmodSync(project.file(nodeBin('shadcn')), 0o755);
    expect(project.run('run', ['shadcn']).status).toBe(1);
  });

  it('reports a tool that cannot be launched', () => {
    chmodSync(project.file(nodeBin('shadcn')), 0o644);
    const result = project.run('run', ['shadcn']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Could not launch shadcn');
  });
});
