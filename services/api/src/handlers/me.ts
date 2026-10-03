import type { GetMeResponse } from '@itera/api-contract';
import type { Context } from 'hono';
import { loadUserSettings } from '../db/user-settings';
import type { AppEnv } from '../env';

/**
 * `GET /me`: the signed-in user and their settings, `null` until they are
 * made. Reads the settings alone: no records, no catch-up, so it answers
 * before the settings exist.
 */
export async function getMe(c: Context<AppEnv>) {
  const { db, userId } = c.var;
  const body: GetMeResponse = {
    userId,
    settings: await loadUserSettings(db, userId),
  };
  return c.json(body, 200);
}
