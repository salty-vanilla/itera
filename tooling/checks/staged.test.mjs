// The pre-commit check in a throwaway Git repository. What matters is that it
// judges the content in the index, not the working tree, and that it skips what
// it should not judge.
import { execFileSync, spawnSync } from 'node:child_process';
import { symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanGitEnv,
  makeTempDir,
  removeTempDir,
  writeFile,
} from '../test-support.mjs';

const script = fileURLToPath(new URL('./staged.mjs', import.meta.url));
const tidy = "export const a = 'x';\n";
const messy = 'export  const a="x"\n';
let repo;

const git = (...args) =>
  execFileSync('git', args, { cwd: repo, env: cleanGitEnv(), stdio: 'pipe' });
const write = (path, content, mode) =>
  writeFile(join(repo, path), content, mode);
const stage = (...paths) => git('add', '-f', '--', ...paths);
// Stages `staged`, then leaves `working` in the working tree.
function stageThenEdit(path, staged, working) {
  write(path, staged);
  stage(path);
  write(path, working);
}
function check() {
  const result = spawnSync(process.execPath, [script], {
    cwd: repo,
    encoding: 'utf8',
    env: cleanGitEnv(),
  });
  return { ...result, output: `${result.stdout}${result.stderr}` };
}
const summary = (result) => result.stdout.trim().split('\n')[0];

beforeEach(() => {
  repo = makeTempDir('staged');
  git('init', '-q');
  write('.prettierrc.json', '{ "singleQuote": true }\n');
  write(
    'eslint.config.mjs',
    "export default [{ files: ['**/*.{js,mjs,ts,tsx}'], rules: { 'no-debugger': 'error' } }];\n",
  );
});
afterEach(() => removeTempDir(repo));

describe('staged checks', { timeout: 30_000 }, () => {
  it('passes with nothing staged', () => {
    const result = check();
    expect(result.status).toBe(0);
    expect(summary(result)).toBe(
      'Staged checks: Prettier 0, ESLint 0, React names 0 (0 = skipped).',
    );
  });

  it('passes formatted, lint-clean staged files and counts them', () => {
    write('a.mjs', tidy);
    write('notes.md', '# Notes\n');
    stage('a.mjs', 'notes.md');
    const result = check();
    expect(result.status).toBe(0);
    expect(summary(result)).toContain('Prettier 2, ESLint 1, React names 0');
    expect(result.stderr).toBe('');
  });

  describe('judges the index, not the working tree', () => {
    it('fails an unformatted staged file even when the working tree is fixed', () => {
      stageThenEdit('a.mjs', messy, tidy);
      const result = check();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Prettier: a.mjs');
      expect(result.stderr).toContain(
        'Fix the reported files, stage the intended changes, and commit again.',
      );
    });

    it('passes a formatted staged file even when the working tree is broken', () => {
      stageThenEdit('a.mjs', tidy, messy);
      expect(check().status).toBe(0);
    });

    it('fails a lint error that is staged even when the working tree is fixed', () => {
      stageThenEdit('a.mjs', `debugger;\n${tidy}`, tidy);
      const result = check();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('no-debugger');
    });

    it('passes a clean staged file even when the working tree has a lint error', () => {
      stageThenEdit('a.mjs', tidy, `debugger;\n${tidy}`);
      expect(check().status).toBe(0);
    });

    it('ignores changes that are not staged', () => {
      write('a.mjs', tidy);
      stage('a.mjs');
      write('untracked.mjs', messy);
      write('b.mjs', tidy);
      stage('b.mjs');
      git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'x');
      write('b.mjs', messy);
      const result = check();
      expect(result.status).toBe(0);
      expect(summary(result)).toContain('Prettier 0');
    });

    it('does not touch the working tree or the index', () => {
      stageThenEdit('a.mjs', messy, tidy);
      const before = git('status', '--porcelain=v2').toString();
      check();
      expect(git('status', '--porcelain=v2').toString()).toBe(before);
    });
  });

  it('reports every failing file, not only the first', () => {
    write('a.mjs', messy);
    write('b.mjs', messy);
    stage('a.mjs', 'b.mjs');
    const result = check();
    expect(result.stderr).toContain('Prettier: a.mjs');
    expect(result.stderr).toContain('Prettier: b.mjs');
    expect(result.status).toBe(1);
  });

  it('reports a file Prettier cannot parse', () => {
    write('broken.ts', 'const = ;\n');
    stage('broken.ts');
    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Prettier: broken.ts:');
  });

  it('keeps file names with spaces and non-ASCII characters intact', () => {
    write('my file.mjs', messy);
    write('日本語.mjs', messy);
    stage('my file.mjs', '日本語.mjs');
    const result = check();
    expect(result.stderr).toContain('Prettier: my file.mjs');
    expect(result.stderr).toContain('Prettier: 日本語.mjs');
  });

  it('checks executable files too', () => {
    write('run.mjs', messy, 0o755);
    stage('run.mjs');
    expect(check().stderr).toContain('Prettier: run.mjs');
  });

  it('uses the .editorconfig of the repository', () => {
    write('.editorconfig', '[*]\nindent_style = space\nindent_size = 4\n');
    write('four.mjs', 'export function f() {\n    return 1;\n}\n');
    write('two.mjs', 'export function f() {\n  return 1;\n}\n');
    stage('four.mjs', 'two.mjs');
    const result = check();
    expect(result.stderr).not.toContain('Prettier: four.mjs');
    expect(result.stderr).toContain('Prettier: two.mjs');
  });

  describe('skips what it should not judge', () => {
    it('files ignored by .prettierignore and .gitignore', () => {
      write('.prettierignore', 'vendor/\n');
      write('.gitignore', 'dist/\n');
      write('vendor/x.json', '{"a":1}\n');
      write('dist/y.json', '{"a":1}\n');
      stage('.prettierignore', '.gitignore', 'vendor/x.json', 'dist/y.json');
      const result = check();
      expect(result.status).toBe(0);
      // The ignore files have no parser; the ignored JSON would fail if checked.
      expect(summary(result)).toContain('Prettier 0');
    });

    it('files with an extension Prettier does not know', () => {
      write('data.unknown', messy);
      stage('data.unknown');
      const result = check();
      expect(result.status).toBe(0);
      expect(summary(result)).toContain('Prettier 0, ESLint 0');
    });

    it('files that ESLint ignores are still formatted, not linted', () => {
      write('eslint.config.mjs', "export default [{ ignores: ['gen/**'] }];\n");
      write('gen/a.mjs', `debugger;\n${tidy}`);
      stage('gen/a.mjs');
      const result = check();
      expect(result.status).toBe(0);
      expect(summary(result)).toContain('Prettier 1, ESLint 0');
    });

    it('symbolic links', () => {
      symlinkSync('not valid ;; target', join(repo, 'link.js'));
      stage('link.js');
      const result = check();
      expect(result.status).toBe(0);
      expect(summary(result)).toContain('Prettier 0, ESLint 0');
    });

    it('deleted files', () => {
      write('a.mjs', tidy);
      stage('a.mjs');
      git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'x');
      git('rm', '-q', 'a.mjs');
      const result = check();
      expect(result.status).toBe(0);
      expect(summary(result)).toContain('Prettier 0');
    });
  });

  describe('React file names', () => {
    it('rejects a component file that is not kebab-case', () => {
      write('apps/web/src/TaskRow.tsx', tidy);
      stage('apps/web/src/TaskRow.tsx');
      const result = check();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'React file names must use kebab-case: apps/web/src/TaskRow.tsx',
      );
      expect(summary(result)).toContain('React names 1');
    });

    it('accepts kebab-case, including test and stories files', () => {
      for (const name of [
        'task-row.tsx',
        'task-row.test.tsx',
        'task-row.stories.tsx',
      ]) {
        write(`apps/web/src/${name}`, tidy);
        stage(`apps/web/src/${name}`);
      }
      const result = check();
      expect(result.status).toBe(0);
      expect(summary(result)).toContain('React names 3');
    });

    it('only looks at .tsx files under apps/web/src', () => {
      write('packages/ui/TaskRow.tsx', tidy);
      write('apps/web/src/TaskRow.ts', tidy);
      stage('packages/ui/TaskRow.tsx', 'apps/web/src/TaskRow.ts');
      const result = check();
      expect(result.status).toBe(0);
      expect(summary(result)).toContain('React names 0');
    });

    it('still checks the content of a file with a bad name', () => {
      write('apps/web/src/TaskRow.tsx', messy);
      stage('apps/web/src/TaskRow.tsx');
      const result = check();
      expect(result.stderr).toContain('React file names must use kebab-case');
      expect(result.stderr).toContain('Prettier: apps/web/src/TaskRow.tsx');
    });
  });
});
