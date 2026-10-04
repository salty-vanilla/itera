import {
  IDEMPOTENCY_KEY_HEADER,
  readIdempotencyKey,
  RequestError,
} from '@itera/api-contract/requests';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Answer } from '../db/idempotency';
import type { AppEnv } from '../env';
import { ApiError } from '../errors';

/**
 * What every write of the contract does first with its Idempotency-Key
 * (ADR 0006 冪等キー): 400 `validation-failed` at the header without one,
 * else the key and the fingerprint of the request (`c.var.write`), for the
 * flow to answer a write sent again with what it answered the first time.
 * Runs after the size limit, as it reads the body.
 */
export const readWrite = createMiddleware<AppEnv>(async (c, next) => {
  let key: string;
  try {
    key = readIdempotencyKey(c.req.header(IDEMPOTENCY_KEY_HEADER));
  } catch (error) {
    if (error instanceof RequestError) throw ApiError.invalid(error.issue);
    throw error;
  }
  c.set('write', { key, fingerprint: await fingerprintOf(c) });
  await next();
});

/**
 * What makes two requests with one key the same write: the method, the
 * path, the query and the body, as they came (a client sends a write again
 * as it is). SHA-256 in hex.
 */
async function fingerprintOf(c: Context<AppEnv>): Promise<string> {
  const { pathname, search } = new URL(c.req.url);
  const text = [c.req.method, pathname, search, await c.req.text()].join('\n');
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** The response of a write's answer, the same each time it is given. */
export function answerResponse(c: Context<AppEnv>, { status, body }: Answer) {
  if (body === null || status === 204) return c.body(null, status);
  return c.body(body, status, { 'Content-Type': 'application/json' });
}

/** A write's answer: its status, and its value as JSON when it has one. */
export function answerOf(status: Answer['status'], value: unknown): Answer {
  return {
    status,
    body: value === undefined ? null : JSON.stringify(value),
  };
}
