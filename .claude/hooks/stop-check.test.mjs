// Cases for stop-check.mjs, against a temporary Git repository and a fake
// check runner. Run with: pnpm agent:hooks:test
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main, skipReason } from './stop-check.mjs';

let root;
let runs;
const pass = () => (runs++, { passed: true, output: '' });
const fail = () => (runs++, { passed: false, output: 'error TS2322\n' });
const stop = (run, input = {}) => main({ input, root, run });
const write = (file, text) => {
  mkdirSync(join(root, file, '..'), { recursive: true });
  writeFileSync(join(root, file), text);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stop-check-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args]);
  git('init', '-q');
  write('.gitignore', '.tools/\n');
  write('a.ts', 'export const a = 1;\n');
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
  runs = 0;
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('stop-check', () => {
  it('does not run on a clean tree (explanation-only turns)', () => {
    expect(stop(pass)).toBeNull();
    expect(runs).toBe(0);
  });

  it('does not run for Markdown-only changes', () => {
    write('docs/notes.md', '# x\n');
    write('README.md', '# y\n');
    expect(stop(pass)).toBeNull();
    expect(runs).toBe(0);
  });

  it('runs for DESIGN.md, .agents/ and code changes', () => {
    for (const files of [['DESIGN.md'], ['.agents/skills/x/SKILL.md']])
      expect(
        skipReason({ stopHookActive: false, files, current: 'x' }),
      ).toBeNull();
    write('a.ts', 'export const a = 2;\n');
    expect(stop(pass)).toBeNull();
    expect(runs).toBe(1);
  });

  it('blocks once with the output tail when the check fails', () => {
    write('a.ts', 'export const a: string = 1;\n');
    const output = stop(fail);
    expect(output?.decision).toBe('block');
    expect(output?.reason).toContain('error TS2322');
    expect(stop(fail, { stop_hook_active: true })).toBeNull();
    expect(runs).toBe(1);
  });

  it('does not rerun for the same tree, and reruns after a change', () => {
    write('b.ts', 'export const b = 1;\n'); // untracked
    stop(fail);
    expect(stop(fail)).toBeNull();
    expect(runs).toBe(1);
    write('b.ts', 'export const b = 2;\n');
    expect(stop(pass)).toBeNull();
    expect(runs).toBe(2);
  });

  it('reports environment problems without blocking or recording', () => {
    write('a.ts', 'export const a = 2;\n');
    const output = stop(() => ({ environment: 'Node v20, need 26' }));
    expect(output).toEqual({
      systemMessage: expect.stringContaining('Node v20, need 26'),
    });
    stop(pass);
    expect(runs).toBe(1);
  });
});
