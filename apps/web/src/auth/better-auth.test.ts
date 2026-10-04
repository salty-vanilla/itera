import { describe, expect, it } from 'vitest';
import { passkeyOutcome } from './better-auth';

describe('passkeyOutcome', () => {
  it('is ok without an error', () => {
    expect(passkeyOutcome(null)).toEqual({ ok: true });
  });

  it('takes a closed or timed-out prompt as cancelled', () => {
    for (const code of [
      'AUTH_CANCELLED',
      'ERROR_CEREMONY_ABORTED',
      'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
    ])
      expect(passkeyOutcome({ code, status: 400 })).toEqual({
        ok: false,
        reason: 'cancelled',
      });
  });

  it('tells apart a passkey already added, a stale sign-in and no session', () => {
    expect(
      passkeyOutcome({
        code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED',
        status: 400,
      }),
    ).toEqual({ ok: false, reason: 'alreadyAdded' });
    expect(passkeyOutcome({ code: 'SESSION_NOT_FRESH', status: 403 })).toEqual({
      ok: false,
      reason: 'notFresh',
    });
    expect(passkeyOutcome({ status: 401 })).toEqual({
      ok: false,
      reason: 'unauthenticated',
    });
  });

  it('takes anything else as failed', () => {
    for (const error of [
      { code: 'AUTHENTICATION_FAILED', status: 400 },
      { code: 'PASSKEY_NOT_FOUND', status: 400 },
      { code: 'ERROR_INVALID_RP_ID', status: 400 },
      { status: 500 },
    ])
      expect(passkeyOutcome(error)).toEqual({ ok: false, reason: 'failed' });
  });
});
