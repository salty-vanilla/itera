import { describe, expect, it } from 'vitest';
import { findDrift } from './migrations.mjs';

const before = ['0000_a.sql', 'meta/0000_snapshot.json', 'meta/_journal.json'];
const quiet = 'No schema changes, nothing to migrate 😴';

describe('findDrift', () => {
  it('accepts a schema that the migrations cover', () => {
    expect(
      findDrift({ before, after: before, status: 0, output: quiet }),
    ).toBeNull();
  });

  it('names the new migration and the command to generate it', () => {
    const problem = findDrift({
      before,
      after: [...before, '0001_b.sql', 'meta/0001_snapshot.json'],
      status: 0,
      output: 'ok',
    });
    expect(problem).toContain('0001_b.sql');
    expect(problem).toContain('pnpm --filter @itera/api db:generate');
  });

  it.each([
    ['a failed run', 1, 'Error: Interactive prompts require a TTY'],
    ['a run that timed out', null, ''],
    ['an unrecognised message', 0, 'something else'],
  ])('fails on %s even when no file was added', (_, status, output) => {
    expect(findDrift({ before, after: before, status, output })).toContain(
      'did not report "No schema changes"',
    );
  });
});
