import * as contract from '@itera/api-contract';
import {
  vCreateAreaBody,
  vGetPlanningQuery,
  vGetRunningQuery,
  vRecordReviewActualBody,
  vRestoreInterruptBody,
} from '@itera/api-contract';
import { createIdSource } from '@itera/application';
import { instant } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { assertWalkable, queryInput, validate } from './validate';

const ids = createIdSource((bytes) => crypto.getRandomValues(bytes));
const at = instant('2026-10-03T00:30:00.000Z');

function failure(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiError)
      return { code: error.code, message: error.message };
    throw error;
  }
  return undefined;
}

describe('validate', () => {
  const review = {
    sprintTaskId: ids.newId('SprintTask', at),
    hours: 1,
    date: '2026-09-30',
  };

  it('returns the schema’s output', () => {
    expect(validate(vRecordReviewActualBody, review, 'body')).toEqual(review);
  });

  it('refuses a value the schema does not take, naming where', () => {
    expect(
      failure(() =>
        validate(vRecordReviewActualBody, { ...review, hours: 'x' }, 'body'),
      ),
    ).toMatchObject({
      code: 'validationFailed',
      message: expect.stringContaining('body.hours'),
    });
  });

  it('refuses a date that does not exist (ADR 0006)', () => {
    const body = { ...review, date: '2026-02-30' };
    expect(
      failure(() => validate(vRecordReviewActualBody, body, 'body')),
    ).toMatchObject({
      code: 'validationFailed',
      message: expect.stringMatching(/^body\.date: /),
    });
  });

  it('refuses a time that does not exist, inside an object', () => {
    const note = {
      id: ids.newId('InterruptNote', at),
      at: '2026-02-30T00:00:00.000Z',
      text: '電話',
    };
    expect(
      failure(() => validate(vRestoreInterruptBody, { note }, 'body')),
    ).toMatchObject({
      code: 'validationFailed',
      message: expect.stringMatching(/^body\.note\.at: /),
    });
  });

  it('does not read text that looks like a date as one', () => {
    expect(validate(vCreateAreaBody, { name: '2026-02-30' }, 'body')).toEqual({
      name: '2026-02-30',
    });
  });

  it('knows every kind of schema in the contract’s requests', () => {
    const requests = Object.entries(contract).filter(([name]) =>
      /^v\w+(Body|Query|Path)$/.test(name),
    );
    expect(requests.length).toBeGreaterThan(60);
    for (const [, schema] of requests) {
      expect(() => assertWalkable(schema as never)).not.toThrow();
    }
  });
});

describe('queryInput', () => {
  it('turns numbers and booleans into their type', () => {
    expect(queryInput(vGetRunningQuery, { sprint: '3' })).toEqual({
      sprint: 3,
    });
    expect(queryInput(vGetPlanningQuery, { applyCriterion: 'false' })).toEqual({
      applyCriterion: false,
    });
  });

  it.each([
    [vGetRunningQuery, { sprint: 'three' }],
    [vGetRunningQuery, { sprint: '' }],
    [vGetRunningQuery, { sprint: '1.5' }],
    [vGetPlanningQuery, { applyCriterion: 'yes' }],
  ])('leaves what does not convert to fail validation: %j', (schema, query) => {
    expect(
      failure(() => validate(schema, queryInput(schema, query), 'query')),
    ).toMatchObject({ code: 'validationFailed' });
  });
});
