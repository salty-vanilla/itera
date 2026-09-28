// Cases for format-edited.mjs. Run with: pnpm agent:hooks:test
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatFile } from './format-edited.mjs';

const hook = fileURLToPath(new URL('./format-edited.mjs', import.meta.url));
const messy = 'const  a = {b:1}\n';
let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'format-edited-'));
  writeFileSync(join(root, '.prettierignore'), '*.md\nignored/\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('formatFile', () => {
  it('formats a file Prettier handles', async () => {
    writeFileSync(join(root, 'a.ts'), messy);
    expect(await formatFile(join(root, 'a.ts'), root)).toBe(true);
    expect(readFileSync(join(root, 'a.ts'), 'utf8')).toBe(
      'const a = { b: 1 };\n',
    );
  });

  it('leaves ignored, unknown, outside and missing files alone', async () => {
    writeFileSync(join(root, 'a.md'), '#  x\n');
    writeFileSync(join(root, 'a.unknown'), messy);
    const outside = mkdtempSync(join(tmpdir(), 'format-edited-outside-'));
    writeFileSync(join(outside, 'a.ts'), messy);
    try {
      expect(await formatFile(join(root, 'a.md'), root)).toBe(false);
      expect(await formatFile(join(root, 'a.unknown'), root)).toBe(false);
      expect(await formatFile(join(outside, 'a.ts'), root)).toBe(false);
      expect(await formatFile(join(root, 'missing.ts'), root)).toBe(false);
      expect(readFileSync(join(outside, 'a.ts'), 'utf8')).toBe(messy);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('exits 0 without output, even when the file does not parse', () => {
    writeFileSync(join(root, 'broken.ts'), 'const = ;\n');
    const result = spawnSync('node', [hook], {
      input: JSON.stringify({
        tool_name: 'Edit',
        tool_input: { file_path: join(root, 'broken.ts') },
      }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(readFileSync(join(root, 'broken.ts'), 'utf8')).toBe('const = ;\n');
  });
});
