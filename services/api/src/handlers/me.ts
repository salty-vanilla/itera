import type { GetMeResponse } from '@itera/api-contract';
import { currentSprints } from '@itera/application';
import type { Context } from 'hono';
import { loadUserSettings } from '../db/user-settings';
import type { AppEnv } from '../env';
import type { Flow } from './flow';

/**
 * `GET /me`: the signed-in user and their settings, `null` until they are
 * made; then also the clock and the Sprints they have now (#295 R1). Before
 * the settings exist it reads them alone (no records, no catch-up), so it
 * answers then; after, it brings the records up to now first, as a read
 * does, so that a Sprint past its end is already in Review.
 */
export async function getMe(c: Context<AppEnv>, flow: Flow) {
  const { db, userId } = c.var;
  const settings = await loadUserSettings(db, userId);
  if (settings === null) {
    const body: GetMeResponse = { userId, settings };
    return c.json(body, 200);
  }
  const { clock, view } = await flow.read(c, currentSprints);
  const body: GetMeResponse = {
    userId,
    settings,
    clock,
    ...(view === null ? {} : { sprints: view }),
  };
  return c.json(body, 200);
}
