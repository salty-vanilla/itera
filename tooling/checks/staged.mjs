import { execFileSync } from 'node:child_process';
import * as prettier from 'prettier';
import { checkReactFileName } from './names.mjs';

function git(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

// NUL delimiters preserve spaces, newlines and Git pathspec characters.
// Read blobs from the index: never stash, rewrite or stage the working tree.
const paths = git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z')
  .split('\0')
  .filter(Boolean);
const entries = new Map(
  git('ls-files', '--stage', '-z')
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const tab = entry.indexOf('\t');
      return [entry.slice(tab + 1), entry.slice(0, tab).split(' ')];
    }),
);

let eslint;
let failed = false;
let formatted = 0;
let linted = 0;
let named = 0;
for (const path of paths) {
  const [mode, blob] = entries.get(path) ?? [];
  // Symlinks and submodules are not source files.
  if (mode !== '100644' && mode !== '100755') continue;

  const info = await prettier.getFileInfo(path, {
    ignorePath: ['.gitignore', '.prettierignore'],
  });
  const format = !info.ignored && info.inferredParser;
  let lint = false;
  if (/\.(?:[cm]?[jt]s|[jt]sx)$/.test(path)) {
    eslint ??= new (await import('eslint')).ESLint();
    lint = !(await eslint.isPathIgnored(path));
  }

  if (lint && path.startsWith('apps/web/src/') && path.endsWith('.tsx')) {
    named++;
    try {
      checkReactFileName(path);
    } catch (error) {
      console.error(error.message);
      failed = true;
    }
  }

  if (!format && !lint) continue;
  const source = git('cat-file', 'blob', blob);
  if (format) {
    formatted++;
    try {
      const options = await prettier.resolveConfig(path);
      if (!(await prettier.check(source, { ...options, filepath: path }))) {
        console.error(`Prettier: ${path}`);
        failed = true;
      }
    } catch (error) {
      console.error(`Prettier: ${path}: ${error.message}`);
      failed = true;
    }
  }
  if (lint) {
    linted++;
    const results = await eslint.lintText(source, { filePath: path });
    if (results.some((result) => result.errorCount || result.warningCount)) {
      const formatter = await eslint.loadFormatter('stylish');
      console.error(formatter.format(results));
      failed = true;
    }
  }
}

console.log(
  `Staged checks: Prettier ${formatted}, ESLint ${linted}, React names ${named} (0 = skipped).`,
);
if (failed) {
  console.error(
    'Fix the reported files, stage the intended changes, and commit again.',
  );
  process.exitCode = 1;
}
