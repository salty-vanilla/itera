// What a failed request means to the app. The API answers with a problem
// (RFC 9457, ADR 0006 エラー); the client decides by its `type` alone, and
// `title` and `detail`, for developers, are never shown. `type` is an open
// enum (ADR 0006 列挙): the generated types name each problem's own value,
// but nothing checks the answer at run time, and the error is read here as
// `unknown`, so a type, a status or a body this client does not know is a
// plain failure, never a failure to read.
import type { ProblemType } from '@itera/api-contract/problems';

/**
 * - `unauthenticated`: no session (401). The person is sent to sign in.
 * - `revisionConflict`: another write came first, and this one was not made
 *   (409). A write that was made answers what it saved instead, by its
 *   Idempotency-Key (ADR 0006 冪等キー). On the records as they now are it
 *   may mean something else, so it is not sent again.
 * - `refused`: the request or the records' state does not allow it (400,
 *   403, 404, 413, 422), or its Idempotency-Key was used for another request
 *   (422). Sending it again gives the same answer. Among
 *   them `user-not-set-up`: the person has no settings yet (the first
 *   settings screen takes their place, #279).
 * - `failed`: anything else, which may have been saved: the server failed
 *   (500), the network, a type this client does not know (ADR 0006
 *   互換の規則). A write with no answer or a 5xx is sent again with its key
 *   (`sendsAgain`).
 */
export type Failure =
  | { readonly kind: 'unauthenticated' }
  | { readonly kind: 'revisionConflict' }
  | { readonly kind: 'refused'; readonly type: ProblemType }
  | { readonly kind: 'failed' };

const REFUSED: ReadonlySet<string> = new Set<ProblemType>([
  '/problems/validation-failed',
  '/problems/forbidden-origin',
  '/problems/not-found',
  '/problems/payload-too-large',
  '/problems/invalid-input',
  '/problems/invalid-transition',
  '/problems/recurring-task-cannot-complete',
  '/problems/user-not-set-up',
  // The key was used for another request: nothing was done (ADR 0006 冪等キー).
  '/problems/idempotency-key-reused',
]);

/**
 * A write that did not go through (use-operation.ts): what the generated
 * client gave as the error, the response's body or what `fetch` threw, and
 * the HTTP status, `undefined` when there was no answer.
 */
export class WriteFailed extends Error {
  override readonly name = 'WriteFailed';

  constructor(
    readonly error: unknown,
    readonly status: number | undefined,
  ) {
    super(
      status === undefined ? 'A write had no answer.' : `A write: ${status}.`,
    );
  }
}

/**
 * The generated client throws the error's body as it came (ADR 0006), or
 * what `fetch` threw when there was no answer; a write throws them in a
 * `WriteFailed`.
 */
export function failureOf(thrown: unknown): Failure {
  const error = thrown instanceof WriteFailed ? thrown.error : thrown;
  const type =
    typeof error === 'object' && error !== null && 'type' in error
      ? error.type
      : undefined;
  if (type === '/problems/unauthenticated') return { kind: 'unauthenticated' };
  if (type === '/problems/revision-conflict')
    return { kind: 'revisionConflict' };
  if (typeof type === 'string' && REFUSED.has(type))
    return { kind: 'refused', type: type as ProblemType };
  return { kind: 'failed' };
}

/**
 * Whether a write is sent again, with the same Idempotency-Key: when it had
 * no answer, or the server failed (5xx), it may have been saved or not, and
 * the same key makes sending it again safe (ADR 0006 冪等キー). Not a 409
 * or another 4xx: the API answered, and it would answer the same, or the
 * write may mean something else on the records as they now are (ADR 0004
 * 同時の書き込み).
 */
export function sendsAgain(error: unknown): boolean {
  return (
    error instanceof WriteFailed &&
    failureOf(error).kind === 'failed' &&
    (error.status === undefined || error.status >= 500)
  );
}
