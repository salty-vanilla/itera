import type { User, UserId } from '@itera/domain';
import { eq } from 'drizzle-orm';
import type { Database } from './database';
import { userSettings } from './schema';

/** The user's settings: the domain's User without its ID. */
export type UserSettings = Omit<User, 'id'>;

/**
 * The user's settings alone, without the rest of their records: `null`
 * until the first save makes them (ADR 0004 「記録のテーブル」).
 */
export async function loadUserSettings(
  db: Database,
  userId: UserId,
): Promise<UserSettings | null> {
  const [row] = await db
    .select({
      displayName: userSettings.displayName,
      timeZone: userSettings.timeZone,
      weekStartsOn: userSettings.weekStartsOn,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return row ?? null;
}
