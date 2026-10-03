import type { HonoRequest } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { ApiError, errorResponse } from '../errors';

// What every write of the contract does with its body: the operations'
// routes and the settings' (ADR 0006 エラー).

/** The largest request body an operation takes (ADR 0006 エラー). */
export const maxBodyBytes = 64 * 1024;

export async function jsonBody(request: HonoRequest): Promise<unknown> {
  try {
    return await request.json<unknown>();
  } catch {
    throw new ApiError('validationFailed', 'body: not JSON.');
  }
}

/** The size limit of a write's body: 413 `payloadTooLarge` over it. */
export const limitBody = bodyLimit({
  maxSize: maxBodyBytes,
  onError: (c) =>
    errorResponse(
      c,
      'payloadTooLarge',
      `The body is larger than ${maxBodyBytes} bytes.`,
    ),
});
