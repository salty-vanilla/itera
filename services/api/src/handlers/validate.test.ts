import * as contract from '@itera/api-contract';
import {
  vCreateAreaBody,
  vRecordReviewActualBody,
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
    const previous = {
      hours: 2,
      setAt: '2026-02-30T00:00:00.000Z',
      source: { kind: 'manual' },
    };
    expect(
      failure(() => validate(vUndoAdoptionBody, { previous }, 'body')),
    ).toMatchObject({
      code: 'validationFailed',
      message: expect.stringMatching(/^body\.previous\.setAt: /),
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
