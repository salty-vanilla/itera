// The generated schemas check what the contract says. Hey API 0.99.0 drops
// the values of a table whose values are a `$ref` (`v.object({})`), which
// patches/@hey-api__openapi-ts@0.99.0.patch fixes (ADR 0006); this fails if
// a schema that checks nothing comes back, after an update or otherwise.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, it } from 'vitest';
import type {
  CreateTaskErrors,
  GetBacklogErrors,
  GetMeErrors,
  ValidationError,
} from './index';
import { vBacklogData, vRetroData } from './index';
import type { Problem } from './problems';
import type { Equal } from './testing';

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

// The error responses are `application/problem+json` (ADR 0006 エラー).
// Hey API reads them as it read `application/json`: each status of each
// operation has its problem's type, never `unknown`.
it('types every error response with its problem', () => {
  const types = readFileSync(
    new URL('generated/types.gen.ts', import.meta.url),
    'utf8',
  );
  const errors = [...types.matchAll(/export type \w+Errors = \{([^}]*)\};/g)];
  expect(errors.length).toBeGreaterThan(60);
  for (const [block, body] of errors) {
    const statuses = [...body!.matchAll(/^\s*(\d{3}): (.+);$/gm)];
    expect(statuses.length, block).toBeGreaterThan(0);
    for (const [, , type] of statuses)
      expect(type, block).not.toMatch(/unknown/);
  }
  const checks: [
    Equal<CreateTaskErrors[400], ValidationError>,
    Equal<GetMeErrors[keyof GetMeErrors] extends Problem ? true : false, true>,
    Equal<
      GetBacklogErrors[keyof GetBacklogErrors] extends Problem ? true : false,
      true
    >,
  ] = [true, true, true];
  expect(checks).toEqual([true, true, true]);
});
