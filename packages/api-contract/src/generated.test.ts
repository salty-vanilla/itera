// The generated schemas check what the contract says. Hey API 0.99.0 drops
// the values of a table whose values are a `$ref` (`v.object({})`), which
// patches/@hey-api__openapi-ts@0.99.0.patch fixes (ADR 0006); this fails if
// a schema that checks nothing comes back, after an update or otherwise.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, it } from 'vitest';
import { vBacklogData, vRetroData } from './index';

it('has no object schema that checks nothing', () => {
  const schemas = readFileSync(
    new URL('generated/valibot.gen.ts', import.meta.url),
    'utf8',
  );
  expect(schemas).not.toMatch(/v\.object\(\{\s*\}\)|v\.unknown\(\)/);
});

it('checks the values of the tables keyed by ID', () => {
  // A value that is not a row fails, in each table.
  expect(v.is(vBacklogData.entries.items, { task_x: {} })).toBe(false);
  expect(v.is(vRetroData.entries.sprintAreas, { area_x: {} })).toBe(false);
  expect(v.is(vRetroData.entries.taskTitles, { task_x: 1 })).toBe(false);
});
