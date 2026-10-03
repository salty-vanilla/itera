import { id, timeZone, type User } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { settingsChange } from './user-changes';

const userId = id<'User'>('user_1');
const input = {
  displayName: 'わたし',
  timeZone: 'Asia/Tokyo',
  weekStartsOn: 1,
} as const;
const user: User = { id: userId, ...input, timeZone: timeZone('Asia/Tokyo') };

describe('settingsChange', () => {
  it('makes the person’s first settings', () => {
    expect(settingsChange(userId, null, input)).toEqual({
      ok: true,
      value: { changes: { user }, created: true },
    });
  });

  it('writes nothing for the same settings again', () => {
    expect(settingsChange(userId, user, input)).toEqual({
      ok: true,
      value: { changes: {}, created: false },
    });
  });

  it('writes another display name', () => {
    expect(
      settingsChange(userId, user, { ...input, displayName: 'ほか' }),
    ).toEqual({
      ok: true,
      value: {
        changes: { user: { ...user, displayName: 'ほか' } },
        created: false,
      },
    });
  });

  it('refuses a time zone that does not exist', () => {
    expect(
      settingsChange(userId, null, { ...input, timeZone: 'Mars/Olympus' }),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });

  it('answers the domain’s refusal of another first day', () => {
    expect(
      settingsChange(userId, user, { ...input, weekStartsOn: 0 }),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });
});
