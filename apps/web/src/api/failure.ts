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
 *   (409); or it was made and the database's answer was lost, which comes
 *   back the same way (ADR 0006 エラー). So it may have been saved: the
 *   reads are read again.
 * - `refused`: the request or the records' state does not allow it (400,
 *   403, 404, 413, 422). Sending it again gives the same answer. Among
 *   them `user-not-set-up`: the person has no settings yet (the first
 *   settings screen takes their place, #279).
 * - `failed`: anything else, which may have been saved too: the server
 *   failed (500), the network, a type this client does not know (ADR 0006
 *   互換の規則).
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
]);

/**
 * The generated client throws the error's body as it came (ADR 0006), or
 * what `fetch` threw when there was no answer.
 */
export function failureOf(error: unknown): Failure {
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
