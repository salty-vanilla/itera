// PostToolUse hook (Edit|Write): format the one file Claude just edited with
// Prettier, using the same ignore files and config resolution as
// tooling/checks/staged.mjs. Never blocks and never reports: a file Prettier
// cannot parse is left as it is, and `pnpm check` reports it later.
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Formats `file` in place when it lies inside `root` and Prettier handles it. */
export async function formatFile(file, root) {
  if (typeof file !== 'string' || file === '') return false;
  let path;
  try {
    path = realpathSync(resolve(root, file));
    root = realpathSync(root);
  } catch {
    return false; // Deleted or never written.
  }
  const inside = relative(root, path);
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside))
    return false;

  const prettier = await import('prettier');
  const info = await prettier.getFileInfo(path, {
    ignorePath: [join(root, '.gitignore'), join(root, '.prettierignore')],
  });
  if (info.ignored || !info.inferredParser) return false;

  const source = readFileSync(path, 'utf8');
  const options = await prettier.resolveConfig(path, { editorconfig: true });
  const formatted = await prettier.format(source, {
    ...options,
    filepath: path,
  });
  if (formatted === source) return false;
  writeFileSync(path, formatted);
  return true;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    await formatFile(input.tool_input?.file_path, root);
  } catch {
    // Syntax errors and unreadable input are left to `pnpm check`.
  }
}
