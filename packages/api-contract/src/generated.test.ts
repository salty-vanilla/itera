// The generated schemas check what the contract says. Hey API 0.99.0 drops
// the values of a table whose values are a `$ref` (`v.object({})`), which
// patches/@hey-api__openapi-ts@0.99.0.patch fixes (ADR 0006); this fails if
// a schema that checks nothing comes back, after an update or otherwise.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('has no object schema that checks nothing', () => {
  const schemas = readFileSync(
    new URL('generated/valibot.gen.ts', import.meta.url),
    'utf8',
  );
  expect(schemas).not.toMatch(/v\.object\(\{\s*\}\)|v\.unknown\(\)/);
});

it('checks the values of the tables keyed by ID', () => {
  const schemas = readFileSync(
    new URL('generated/valibot.gen.ts', import.meta.url),
    'utf8',
  );
  expect(schemas).toContain('items: v.record(v.string(), vBacklogItem)');
  expect(schemas).toContain(
    'sprintAreas: v.record(v.string(), vSprintAreaLabel)',
  );
});
