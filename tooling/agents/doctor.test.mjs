// agent:doctor with every probed tool replaced by a fake: one OK / FAIL line
// per check, a failing check does not stop the rest, and exit 1 if any failed.
import { chmodSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAgentProject, platform } from './fixture.mjs';

const checks = [
  'Project Node',
  'Skill integrity',
  'pnpm',
  'Claude Code',
  'GitHub auth',
  'Impeccable engine',
  'Playwright CLI',
  'shadcn',
];
const ok = '#!/bin/sh\nexit 0\n';
let project;

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
  mkdirSync(project.file('.agents/skills'), { recursive: true });
  project.tool('pnpm', ok);
  project.tool('claude', ok);
  project.tool('gh', ok);
  for (const name of ['playwright-cli', 'shadcn']) {
    project.write(`tooling/agents/node_modules/.bin/${name}`, ok);
    chmodSync(project.file(`tooling/agents/node_modules/.bin/${name}`), 0o755);
  }
  const engine = join(
    project.cache,
    'impeccable/9.9.9',
    platform,
    'impeccable',
  );
  project.write(
    join('.tools/agents/impeccable/9.9.9', platform, 'impeccable'),
    ok,
  );
  chmodSync(engine, 0o755);
  symlinkSync(process.execPath, join(project.cache, 'node'));
});
afterEach(() => project.cleanup());

describe('agent:doctor', () => {
  it('reports every check as OK and exits 0', () => {
    const result = project.run('doctor');
    expect(result.output).toBe(checks.map((name) => `OK ${name}\n`).join(''));
    expect(result.status).toBe(0);
  });

  it.each([
    ['Project Node', () => rmSync(join(project.cache, 'node'))],
    [
      'Skill integrity',
      () => rmSync(project.file('.agents'), { recursive: true }),
    ],
    ['pnpm', () => project.tool('pnpm', '#!/bin/sh\nexit 1\n')],
    ['Claude Code', () => rmSync(join(project.bin, 'claude'))],
    ['GitHub auth', () => project.tool('gh', '#!/bin/sh\nexit 1\n')],
    [
      'Impeccable engine',
      () => rmSync(project.cache + '/impeccable', { recursive: true }),
    ],
    [
      'Playwright CLI',
      () =>
        project.write(
          'tooling/agents/node_modules/.bin/playwright-cli',
          '#!/bin/sh\nexit 2\n',
        ),
    ],
    [
      'shadcn',
      () => rmSync(project.file('tooling/agents/node_modules/.bin/shadcn')),
    ],
  ])('reports %s as FAIL, still runs the rest, and exits 1', (name, break_) => {
    break_();
    const result = project.run('doctor');
    expect(result.status).toBe(1);
    expect(result.stdout.split('\n').filter(Boolean)).toEqual(
      checks.map((check) => `${check === name ? 'FAIL' : 'OK'} ${check}`),
    );
  });

  it('never prints the output of the authentication check', () => {
    project.tool(
      'gh',
      '#!/bin/sh\necho "token ghp_SECRET"\necho "token ghp_SECRET" >&2\nexit 1\n',
    );
    const result = project.run('doctor');
    expect(result.output).toContain('FAIL GitHub auth');
    expect(result.output).not.toContain('ghp_SECRET');
  });
});
