import * as contract from '@itera/api-contract';
import {
  vCreateAreaBody,
  vRecordActualTimeBody,
  vUndoAdoptionBody,
} from '@itera/api-contract';
import { createIdSource } from '@itera/application';
import { instant } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../errors';
import { assertWalkable, validate } from './validate';

const ids = createIdSource((bytes) => crypto.getRandomValues(bytes));
const at = instant('2026-10-03T00:30:00.000Z');

function failure(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiError) return error.failure;
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
    expect(validate(vRecordActualTimeBody, review, 'body')).toEqual(review);
  });

  it('refuses a value the schema does not take, naming where', () => {
    expect(
      failure(() =>
        validate(vRecordActualTimeBody, { ...review, hours: 'x' }, 'body'),
      ),
    ).toEqual({
      type: '/problems/validation-failed',
      errors: [{ detail: expect.any(String), pointer: '#/hours' }],
    });
  });

  it('names every place that does not match, once each', () => {
    const body = { sprintTaskId: 'x', hours: 'x', date: '2026-09-30' };
    expect(
      failure(() => validate(vRecordActualTimeBody, body, 'body')),
    ).toMatchObject({
      errors: [{ pointer: '#/sprintTaskId' }, { pointer: '#/hours' }],
    });
  });

  it('names a path or query parameter by its name', () => {
    expect(
      failure(() =>
        validate(contract.vGetSprintPath, { sprintId: 'task_x' }, 'path'),
      ),
    ).toMatchObject({ errors: [{ parameter: 'sprintId' }] });
    expect(
      failure(() =>
        validate(contract.vGetDayPath, { date: '2026-02-30' }, 'path'),
      ),
    ).toMatchObject({ errors: [{ parameter: 'date' }] });
  });

  it('refuses a date that does not exist (ADR 0006)', () => {
    const body = { ...review, date: '2026-02-30' };
    expect(
      failure(() => validate(vRecordActualTimeBody, body, 'body')),
    ).toEqual({
      type: '/problems/validation-failed',
      errors: [{ detail: expect.any(String), pointer: '#/date' }],
    });
  });

  it('refuses a time that does not exist, inside an object', () => {
    const previous = {
      hours: 2,
      setAt: '2026-02-30T00:00:00.000Z',
      source: { kind: 'manual' },
    };
    expect(
      failure(() => validate(vUndoAdoptionBody, { previous }, 'body')),
    ).toEqual({
      type: '/problems/validation-failed',
      errors: [{ detail: expect.any(String), pointer: '#/previous/setAt' }],
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
