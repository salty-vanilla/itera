// The problem's `type` is an open enum (ADR 0006 列挙): what this client
// does not know is a plain failure, never a failure to read the answer.
import {
  problemOf,
  validationProblem,
  type PlainProblemType,
} from '@itera/api-contract/problems';
import { describe, expect, it } from 'vitest';
import { failureOf, sendsAgain, WriteFailed } from './failure';

describe('failureOf', () => {
  it('reads the types the contract names', () => {
    expect(failureOf(problemOf('/problems/unauthenticated', ''))).toEqual({
      kind: 'unauthenticated',
    });
    expect(failureOf(problemOf('/problems/revision-conflict', ''))).toEqual({
      kind: 'revisionConflict',
    });
    const refused: readonly PlainProblemType[] = [
      '/problems/forbidden-origin',
      '/problems/not-found',
      '/problems/payload-too-large',
      '/problems/invalid-input',
      '/problems/invalid-transition',
      '/problems/recurring-task-cannot-complete',
      '/problems/user-not-set-up',
    ];
    for (const type of refused)
      expect(failureOf(problemOf(type, ''))).toEqual({ kind: 'refused', type });
    expect(
      failureOf(validationProblem([{ detail: '', pointer: '#/title' }])),
    ).toEqual({ kind: 'refused', type: '/problems/validation-failed' });
    expect(failureOf(problemOf('/problems/internal-error', ''))).toEqual({
      kind: 'failed',
    });
  });

  it('takes what it does not know as a plain failure', () => {
    // A type added later, with or without the other members.
    expect(failureOf({ type: '/problems/quota-exceeded' })).toEqual({
      kind: 'failed',
    });
    // The error shape before RFC 9457 (contract 0.2), by an older server.
    expect(failureOf({ code: 'notFound', message: '' })).toEqual({
      kind: 'failed',
    });
    // Not JSON (a proxy's page), no answer (the network), nothing at all.
    expect(failureOf('413 Request Entity Too Large')).toEqual({
      kind: 'failed',
    });
    expect(failureOf(new TypeError('Failed to fetch'))).toEqual({
      kind: 'failed',
    });
    expect(failureOf({})).toEqual({ kind: 'failed' });
    expect(failureOf(null)).toEqual({ kind: 'failed' });
    expect(failureOf({ type: 42 })).toEqual({ kind: 'failed' });
  });
});

describe('a write that failed', () => {
  it('is read by what it carries', () => {
    expect(
      failureOf(
        new WriteFailed(problemOf('/problems/revision-conflict', ''), 409),
      ),
    ).toEqual({ kind: 'revisionConflict' });
    expect(
      failureOf(
        new WriteFailed(problemOf('/problems/idempotency-key-reused', ''), 422),
      ),
    ).toEqual({ kind: 'refused', type: '/problems/idempotency-key-reused' });
  });

  it('is sent again with its key with no answer or a server failure only (ADR 0006 冪等キー)', () => {
    const write = (error: unknown, status: number | undefined) =>
      sendsAgain(new WriteFailed(error, status));
    expect(write(new TypeError('Failed to fetch'), undefined)).toBe(true);
    expect(write(problemOf('/problems/internal-error', ''), 500)).toBe(true);
    expect(write('<html>Bad Gateway</html>', 502)).toBe(true);
    // The API answered: the same again, or another meaning now.
    expect(write(problemOf('/problems/revision-conflict', ''), 409)).toBe(
      false,
    );
    expect(write(problemOf('/problems/not-found', ''), 404)).toBe(false);
    expect(write({ type: '/problems/something-new' }, 418)).toBe(false);
    // A read's failure is not a write's.
    expect(sendsAgain(new TypeError('Failed to fetch'))).toBe(false);
  });
});
