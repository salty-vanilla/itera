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

// An Area is called Area (AGENTS.md ドメインの扱い). The one file of apps/web
// with "domain" in its name is the module of the domain layer's functions;
// the identifiers and texts are checked by ESLint (eslint.config.js).
export function checkAreaFileName(path) {
  if (
    path.startsWith('apps/web/src/') &&
    /domain/i.test(basename(path)) &&
    path !== 'apps/web/src/lib/domain-functions.ts'
  ) {
    throw new Error(
      `Call an Area an Area, not "domain" (AGENTS.md ドメインの扱い): ${path}`,
    );
  }
}

function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) check(path);
    else {
      checkReactFileName(path);
      checkAreaFileName(path);
    }
  }
}
// apps/web does not exist until the Web app is scaffolded.
if (
  resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url) &&
  existsSync('apps/web/src')
) {
  check('apps/web/src');
}
