import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The Activity log is written and never read back (ADR 0004 「記録のテーブル」),
// except by the one query that tells whether the user deleted an InterruptNote
// (ADR 0004 「Activity を読む 1 つの例外」). Holds that boundary: a read of
// the log for another decision is a decision to make in the ADR, not a line.
// It is a net for the usual ways to read the table, not a proof.
const source = decodeURIComponent(new URL('..', import.meta.url).pathname);

/** The files that write the log or read it; the schema declares it. */
const reader = 'db/deleted-interrupts.ts';
const writer = 'db/save-records.ts';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) return sources(`${path}/`);
    const test =
      entry.name.endsWith('.test.ts') || entry.name === 'operation-cases.ts';
    return entry.name.endsWith('.ts') && !test ? [path] : [];
  });
}

const files = sources(source).map((path) => ({
  name: path.slice(source.length),
  text: readFileSync(path, 'utf8'),
}));

const using = (pattern: RegExp) =>
  files
    .filter(({ text }) => pattern.test(text))
    .map(({ name }) => name)
    .toSorted();

describe('the Activity log', () => {
  it('is imported from the schema by the save and the check only', () => {
    // `activity`, also renamed (`activity as log`), among a file's imports.
    expect(
      using(/import\s*\{[^}]*\bactivity\b[^}]*\}\s*from\s*'[^']*schema'/),
    ).toEqual([reader, writer]);
  });

  it('is not reached through the schema object, the query API or raw SQL', () => {
    expect(using(/\b(?:schema|query)\.activity\b/)).toEqual([]);
    expect(using(/\bfrom\s+["`]?activity\b/i)).toEqual([]);
  });

  it('is read by one query, in the check of a deleted InterruptNote', () => {
    const reads = (text: string) => text.match(/\.from\(\s*activity\s*\)/g);
    const found = files.flatMap(({ name, text }) =>
      (reads(text) ?? []).map(() => name),
    );
    expect(found).toEqual([reader]);
  });
});
