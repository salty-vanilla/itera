import { meResponse, settingsSurface } from '@itera/api-contract/requests';
import { currentSprints } from '@itera/application';
import type { Context } from 'hono';
import { loadUserSettings } from '../db/user-settings';
import type { AppEnv } from '../env';
import type { Flow } from './flow';
import { jsonBody } from './body';
import { answerOf, answerResponse } from './idempotency';
import { validate } from './validate';

/**
 * `GET /me`: the signed-in user and their settings, `null` until they are
 * made; then also the clock and the Sprints they have now (#295 R1), as
 * `meResponse` answers it for the browser mock too (#350). Before the
 * settings exist it reads them alone (no records, no catch-up), so it
 * answers then; after, it brings the records up to now first, as a read
 * does, so that a Sprint past its end is already in Review.
 */
export async function getMe(c: Context<AppEnv>, flow: Flow) {
  const { db, userId } = c.var;
  const settings = await loadUserSettings(db, userId);
  const body = await meResponse(userId, settings, () =>
    flow.read(c, currentSprints),
  );
  return c.json(body, 200);
}

/**
 * `PUT /me/settings`: the person's settings (ADR 0006「利用者」), made the
 * first time (201) and written again after (204). A write like the
 * operations, with an Idempotency-Key (ADR 0006 冪等キー). The body is checked with
 * the contract's schema; the time zone and the rule (the time zone and the
 * first day are fixed once made) by `settingsChange`.
 */
export async function putSettings(c: Context<AppEnv>, flow: Flow) {
  const body = validate(settingsSurface.body, await jsonBody(c.req), 'body');
  const answer = await flow.setUp(c, body, ({ created, settings }) => ({
    ...(created
      ? answerOf(settingsSurface.status.created, settings)
      : answerOf(settingsSurface.status.written, undefined)),
    etag: null,
  }));
  return answerResponse(c, answer);
}
