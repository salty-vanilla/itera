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

describe('a value added to an enum, by its description', () => {
  // A bundled contract the way oasdiff's property paths walk it: a property,
  // `items`, `additionalProperties`, a `oneOf` branch by `$ref` or by its
  // place, and an `allOf` that oasdiff flattens.
  const spec = {
    paths: {
      '/backlog': {
        get: {
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      view: { $ref: '#/components/schemas/View' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        View: {
          type: 'object',
          properties: {
            // A property named `items`, as the Backlog has.
            items: {
              type: 'object',
              additionalProperties: { $ref: '#/components/schemas/Row' },
            },
            day: {
              oneOf: [
                { $ref: '#/components/schemas/Today' },
                {
                  title: 'Other',
                  type: 'object',
                  properties: { via: { $ref: '#/components/schemas/Via' } },
                },
              ],
            },
          },
        },
        Row: {
          allOf: [
            {
              type: 'object',
              properties: {
                createdVia: { $ref: '#/components/schemas/Via' },
                state: { $ref: '#/components/schemas/State' },
                tags: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Via' },
                },
              },
            },
          ],
        },
        Today: {
          type: 'object',
          properties: { state: { $ref: '#/components/schemas/State' } },
        },
        Via: {
          description: 'Open enum. Where the Task was made.',
          type: 'string',
          enum: ['backlog', 'today'],
        },
        State: {
          description: 'Closed enum. Where the Task is in its life.',
          type: 'string',
          enum: ['active', 'done'],
        },
      },
    },
  };
  /** @param {string} property */
  const added = (property) =>
    change(
      'response-property-enum-value-added',
      `added the new \`x\` enum value to the \`${property}\` response property for the response status \`200\``,
    );
  const base = {
    base: '0.8.0',
    head: '0.8.0',
    contracts: { base: spec, head: spec },
  };

  it('takes a value added to an enum that says `Open enum.` as compatible', () => {
    const changes = [
      added('view/items/additionalProperties/createdVia'),
      added('view/day/oneOf[subschema #2: Other]/via'),
      added('view/items/additionalProperties/tags/items/'),
    ];
    const result = assess({ ...base, changes });
    expect(result.breaking).toEqual([]);
    expect(result.open).toEqual(changes);
    expect(result.problems).toEqual([]);
  });

  it('keeps a value added to an enum that says `Closed enum.` breaking', () => {
    const changes = [
      added('view/items/additionalProperties/state'),
      added('view/day/oneOf[#/components/schemas/Today]/state'),
    ];
    const result = assess({ ...base, changes });
    expect(result.breaking).toEqual(changes);
    expect(result.open).toEqual([]);
    expect(result.problems[0]).toContain('Raise it to 0.9.0');
  });

  it('does not take the word anywhere but at the start of the description', () => {
    const named = structuredClone(spec);
    named.components.schemas.Via.description =
      'An Open enum. Where it was made.';
    const changes = [added('view/items/additionalProperties/createdVia')];
    expect(
      assess({
        ...base,
        changes,
        contracts: { base: spec, head: named },
      }).breaking,
    ).toEqual(changes);
  });

  it('keeps a change breaking when its path cannot be followed', () => {
    const changes = [
      added('view/nothing/createdVia'),
      added('view/day/oneOf[subschema #9: Missing]/via'),
      added('view/items/additionalProperties'),
    ];
    expect(assess({ ...base, changes }).breaking).toEqual(changes);
  });

  it('keeps a change breaking without the contracts, and in another operation', () => {
    const one = added('view/items/additionalProperties/createdVia');
    const contracts = { base: spec, head: spec };
    expect(isOpenEnumAddition(one, contracts)).toBe(true);
    expect(isOpenEnumAddition(one)).toBe(false);
    expect(isOpenEnumAddition({ ...one, path: '/nowhere' }, contracts)).toBe(
      false,
    );
    expect(
      assess({ ...base, changes: [one], contracts: { base: {}, head: {} } })
        .breaking,
    ).toEqual([one]);
  });

  it('keeps a value breaking when the enum was closed in the base and is opened with it', () => {
    const closed = structuredClone(spec);
    closed.components.schemas.Via.description =
      'Closed enum. Where it was made.';
    const changes = [added('view/items/additionalProperties/createdVia')];
    expect(
      assess({ ...base, changes, contracts: { base: closed, head: spec } })
        .breaking,
    ).toEqual(changes);
  });

  describe('where a branch of a `oneOf` has moved', () => {
    // oasdiff writes the branch as `<in the base> -> <in the head>` once its
    // place in the list differs.
    /** @param {string} title @param {string} kind */
    const branch = (title, kind) => ({
      title,
      type: 'object',
      properties: {
        state: {
          description: `${kind} enum. A state of ${title}.`,
          type: 'string',
          enum: ['a'],
        },
      },
    });
    /** @param {unknown[]} branches */
    const day = (branches) => ({
      paths: {
        '/backlog': {
          get: {
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { day: { oneOf: branches } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    // A is removed in the head (a compatible change in a response), so B
    // and C move up. The head's second branch is C, which is open.
    const contracts = {
      base: day([
        branch('A', 'Closed'),
        branch('B', 'Closed'),
        branch('C', 'Open'),
      ]),
      head: day([branch('B', 'Closed'), branch('C', 'Open')]),
    };

    it('reads each contract at its own place', () => {
      const moved = added(
        'day/oneOf[subschema #3: C -> subschema #2: C]/state',
      );
      expect(isOpenEnumAddition(moved, contracts)).toBe(true);
    });

    it('does not read the base’s number in the head', () => {
      const closed = added(
        'day/oneOf[subschema #2: B -> subschema #1: B]/state',
      );
      expect(isOpenEnumAddition(closed, contracts)).toBe(false);
    });
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
