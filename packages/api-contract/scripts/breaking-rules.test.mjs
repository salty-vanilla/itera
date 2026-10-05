import { describe, expect, it } from 'vitest';
import {
  ERR,
  WARN,
  allowsBreaking,
  assess,
  isOpenEnumAddition,
  parseVersion,
  untitledBranches,
} from './breaking-rules.mjs';

/** @param {string} id @param {string} text @param {number} [level] */
const change = (id, text, level = ERR) => ({
  id,
  text,
  level,
  operation: 'GET',
  path: '/backlog',
});

const errorBranch = change(
  'response-body-one-of-added',
  'added `#/components/schemas/IdempotencyKeyReusedError` to the response body `oneOf` list for the response status `422`',
);
const errorType = change(
  'response-property-enum-value-added',
  'added the new `/problems/new-one` enum value to the `oneOf[#/components/schemas/RuleViolationError]/type` response property for the response status `422`',
);
const removedProperty = change(
  'response-required-property-removed',
  'removed the required property `view/items/additionalProperties/canComplete` from the response with the `200` status',
);

describe('isOpenEnumAddition', () => {
  it('takes a branch added to an error body as an open enum', () => {
    expect(isOpenEnumAddition(errorBranch)).toBe(true);
  });

  it('takes a value added to an error type as an open enum', () => {
    expect(isOpenEnumAddition(errorType)).toBe(true);
  });

  it('keeps a branch or a value added to a successful response breaking', () => {
    expect(
      isOpenEnumAddition(
        change(
          'response-body-one-of-added',
          'added `#/components/schemas/X` to the response body `oneOf` list for the response status `200`',
        ),
      ),
    ).toBe(false);
    expect(
      isOpenEnumAddition(
        change(
          'response-property-enum-value-added',
          'added the new `review` enum value to the `view/state` response property for the response status `200`',
        ),
      ),
    ).toBe(false);
  });

  it('keeps a value added to another enum of an error breaking', () => {
    expect(
      isOpenEnumAddition(
        change(
          'response-property-enum-value-added',
          'added the new `cookie` enum value to the `errors/items/in` response property for the response status `400`',
        ),
      ),
    ).toBe(false);
    expect(
      isOpenEnumAddition(
        change(
          'response-property-enum-value-added',
          'added the new `x` enum value to the `subtype` response property for the response status `422`',
        ),
      ),
    ).toBe(false);
    expect(
      isOpenEnumAddition(
        change(
          'response-property-enum-value-added',
          'added the new `x` enum value to the `oneOf[#/components/schemas/ValidationError]/errors/items/type` response property for the response status `400`',
        ),
      ),
    ).toBe(false);
  });
});

describe('allowsBreaking', () => {
  it.each([
    ['0.8.0', '0.9.0', true],
    ['0.8.0', '1.0.0', true],
    ['0.8.0', '0.8.1', false],
    ['0.8.0', '0.8.0', false],
    ['1.0.0', '2.0.0', true],
    ['1.0.0', '1.1.0', false],
  ])('from %s to %s: %s', (base, head, allowed) => {
    expect(
      allowsBreaking(
        /** @type {number[]} */ (parseVersion(base)),
        /** @type {number[]} */ (parseVersion(head)),
      ),
    ).toBe(allowed);
  });
});

describe('assess', () => {
  it('passes compatible changes without a new version', () => {
    const result = assess({
      changes: [errorBranch, errorType],
      base: '0.8.0',
      head: '0.8.0',
    });
    expect(result.breaking).toEqual([]);
    expect(result.open).toHaveLength(2);
    expect(result.problems).toEqual([]);
  });

  it('asks for the next minor while the major is 0', () => {
    const { problems } = assess({
      changes: [removedProperty],
      base: '0.8.0',
      head: '0.8.0',
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Raise it to 0.9.0');
  });

  it('asks for the next major from 1.0.0', () => {
    const { problems } = assess({
      changes: [removedProperty],
      base: '1.2.0',
      head: '1.3.0',
    });
    expect(problems[0]).toContain('Raise it to 2.0.0');
  });

  it('passes a breaking change with the version raised', () => {
    const result = assess({
      changes: [removedProperty, errorBranch],
      base: '0.8.0',
      head: '0.9.0',
    });
    expect(result.breaking).toEqual([removedProperty]);
    expect(result.problems).toEqual([]);
  });

  it('passes a raised version without a change it finds (a change of meaning)', () => {
    expect(
      assess({ changes: [], base: '0.7.0', head: '0.8.0' }).problems,
    ).toEqual([]);
  });

  it('does not count what oasdiff could not decide', () => {
    const undecided = change(
      'response-property-type-changed',
      'the `view` response property type changed',
      WARN,
    );
    const result = assess({
      changes: [undecided],
      base: '0.8.0',
      head: '0.8.0',
    });
    expect(result.potential).toEqual([undecided]);
    expect(result.problems).toEqual([]);
  });

  it('stops on a version that goes down or is not MAJOR.MINOR.PATCH', () => {
    expect(
      assess({ changes: [], base: '0.8.0', head: '0.7.0' }).problems[0],
    ).toContain('went down');
    expect(
      assess({ changes: [], base: '0.8.0', head: '0.9' }).problems[0],
    ).toContain('MAJOR.MINOR.PATCH');
  });
});

describe('untitledBranches', () => {
  const object = (/** @type {string} */ kind) => ({
    type: 'object',
    properties: { kind: { const: kind } },
  });

  it('finds a list of inline object branches without titles', () => {
    expect(
      untitledBranches({
        components: {
          schemas: {
            'Day/View': { oneOf: [object('today'), object('other')] },
          },
        },
      }),
    ).toEqual(['#/components/schemas/Day~1View/oneOf']);
  });

  it('accepts titled branches, one inline branch, and other branches', () => {
    expect(
      untitledBranches({
        a: {
          oneOf: [
            { title: 'Today', ...object('today') },
            { title: 'Other', ...object('other') },
          ],
        },
        b: { oneOf: [{ $ref: '#/X' }, object('one')] },
        c: { anyOf: [{ type: 'number' }, { type: 'null' }] },
      }),
    ).toEqual([]);
  });

  it('finds untitled branches under anyOf, of allOf only, or beside a titled one', () => {
    expect(
      untitledBranches({
        a: { anyOf: [object('one'), object('two')] },
        b: { oneOf: [{ allOf: [{ $ref: '#/X' }] }, object('two')] },
        c: { oneOf: [{ title: 'One', ...object('one') }, object('two')] },
      }),
    ).toEqual(['#/a/anyOf', '#/b/oneOf', '#/c/oneOf']);
  });
});
