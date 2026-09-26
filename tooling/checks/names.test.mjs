import { describe, expect, it } from 'vitest';
import { checkReactFileName } from './names.mjs';

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
