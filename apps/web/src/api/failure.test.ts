// The error's `code` is an open enum (ADR 0006 列挙): what this client does
// not know is a plain failure, never a failure to read the answer.
import { describe, expect, it } from 'vitest';
import { failureOf } from './failure';

describe('failureOf', () => {
  it('reads the codes the contract names', () => {
    expect(failureOf({ code: 'unauthenticated', message: '' })).toEqual({
      kind: 'unauthenticated',
    });
    expect(failureOf({ code: 'revisionConflict', message: '' })).toEqual({
      kind: 'revisionConflict',
    });
    for (const code of [
      'validationFailed',
      'forbiddenOrigin',
      'notFound',
      'payloadTooLarge',
      'invalidInput',
      'invalidTransition',
      'recurringTaskCannotComplete',
      'userNotSetUp',
    ])
      expect(failureOf({ code, message: '' })).toEqual({
        kind: 'refused',
        code,
      });
    expect(failureOf({ code: 'internalError', message: '' })).toEqual({
      kind: 'failed',
    });
  });

  it('takes what it does not know as a plain failure', () => {
    // A code added later, with or without a message.
    expect(failureOf({ code: 'quotaExceeded' })).toEqual({ kind: 'failed' });
    // Not JSON (a proxy's page), no answer (the network), nothing at all.
    expect(failureOf('413 Request Entity Too Large')).toEqual({
      kind: 'failed',
    });
    expect(failureOf(new TypeError('Failed to fetch'))).toEqual({
      kind: 'failed',
    });
    expect(failureOf({})).toEqual({ kind: 'failed' });
    expect(failureOf(null)).toEqual({ kind: 'failed' });
    expect(failureOf({ code: 42 })).toEqual({ kind: 'failed' });
  });
});
