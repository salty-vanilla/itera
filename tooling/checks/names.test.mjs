import { describe, expect, it } from 'vitest';
import { checkAreaFileName, checkReactFileName } from './names.mjs';

describe('checkReactFileName', () => {
  it.each([
    'apps/web/src/task-row.tsx',
    'apps/web/src/features/today/today-screen.test.tsx',
    'apps/web/src/button.stories.tsx',
    'packages/domain/src/TaskRow.tsx',
  ])('accepts %s', (path) => {
    expect(() => checkReactFileName(path)).not.toThrow();
  });

  it.each(['apps/web/src/TaskRow.tsx', 'apps/web/src/task_row.tsx'])(
    'rejects %s',
    (path) => {
      expect(() => checkReactFileName(path)).toThrow(/kebab-case/);
    },
  );
});

describe('checkAreaFileName', () => {
  it.each([
    'apps/web/src/lib/domain-functions.ts',
    'apps/web/src/screens/backlog/area-dialog.tsx',
    'packages/domain/src/domain-error.ts',
  ])('accepts %s', (path) => {
    expect(() => checkAreaFileName(path)).not.toThrow();
  });

  it.each([
    'apps/web/src/screens/backlog/domain-dialog.tsx',
    'apps/web/src/lib/domains.ts',
    'apps/web/src/components/DomainChip.tsx',
    'apps/web/src/screens/domain-functions.ts',
    'apps/web/src/screens/domains/list.tsx',
  ])('rejects %s', (path) => {
    expect(() => checkAreaFileName(path)).toThrow(/Area/);
  });
});
