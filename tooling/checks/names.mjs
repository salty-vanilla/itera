import { existsSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkReactFileName(path) {
  if (
    path.startsWith('apps/web/src/') &&
    path.endsWith('.tsx') &&
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.(?:test|spec|stories))?\.tsx$/.test(
      basename(path),
    )
  ) {
    throw new Error(`React file names must use kebab-case: ${path}`);
  }
}

function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) check(path);
    else checkReactFileName(path);
  }
}
// apps/web does not exist until the Web app is scaffolded.
if (
  resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url) &&
  existsSync('apps/web/src')
) {
  check('apps/web/src');
}
