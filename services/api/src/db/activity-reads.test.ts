import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The Activity log is written and never read back (ADR 0004 「記録のテーブル」),
// except by the one query that tells whether the user deleted an InterruptNote
// (ADR 0006 「消した記録を戻す操作の照合」). Holds that boundary: a read of
// the log for another decision is a decision to make in the ADR, not a line.
const source = decodeURIComponent(new URL('..', import.meta.url).pathname);

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) return sources(`${path}/`);
    const test =
      entry.name.endsWith('.test.ts') || entry.name === 'operation-cases.ts';
    return entry.name.endsWith('.ts') && !test ? [path] : [];
  });
}

const using = (pattern: RegExp) =>
  sources(source)
    .filter((path) => pattern.test(readFileSync(path, 'utf8')))
    .map((path) => path.slice(source.length))
    .toSorted();

describe('the Activity log', () => {
  it('is read only by the check of a deleted InterruptNote', () => {
    expect(using(/\bfrom\(\s*activity\s*\)/)).toEqual([
      'db/deleted-interrupts.ts',
    ]);
  });
});
