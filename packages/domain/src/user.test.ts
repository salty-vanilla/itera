import { describe, expect, it } from 'vitest';
import type { Result } from './shared/result';
import { timeZone } from './shared/time';
import { setUpUser, type User } from './user';
import { userId } from './testing';

const user: User = {
  id: userId,
  displayName: 'わたし',
  timeZone: timeZone('Asia/Tokyo'),
  weekStartsOn: 1,
};

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('User', () => {
  it('is made from the first settings, the name trimmed', () => {
    const result = unwrap(
      setUpUser(null, { ...user, displayName: ' わたし ' }),
    );
    expect(result).toEqual({ user, created: true });
  });

  it('refuses an empty name', () => {
    const result = setUpUser(null, { ...user, displayName: '  ' });
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'invalidInput' },
    });
  });

  it('takes the same settings again without a change', () => {
    expect(unwrap(setUpUser(user, user))).toEqual({ user, created: false });
  });

  it('writes the display name again, trimmed', () => {
    const result = unwrap(setUpUser(user, { ...user, displayName: ' ほか ' }));
    expect(result).toEqual({
      user: { ...user, displayName: 'ほか' },
      created: false,
    });
  });

  it('refuses another time zone or first day once they are made', () => {
    for (const other of [
      { ...user, timeZone: timeZone('UTC') },
      { ...user, weekStartsOn: 0 as const },
    ]) {
      expect(setUpUser(user, other)).toMatchObject({
        ok: false,
        error: { code: 'invalidInput' },
      });
    }
  });
});
