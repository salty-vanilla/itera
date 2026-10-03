// What a failed request means to the app. The API answers with `{ code,
// message }` (ADR 0006 エラー); the client decides by `code` alone, and the
// message, for developers, is never shown. `code` is an open enum (ADR 0006
// 列挙): the generated types name each error's own value, but nothing
// checks the answer at run time, and the error is read here as `unknown`, so
// a code, a status or a body this client does not know is a plain failure,
// never a failure to read.
import type {
  ForbiddenOriginError,
  InternalError,
  NotFoundError,
  PayloadTooLargeError,
  RevisionConflictError,
  RuleViolationError,
  UnauthenticatedError,
  UserNotSetUpError,
  ValidationError,
} from '@itera/api-contract';

export type ErrorCode =
  | ValidationError['code']
  | UnauthenticatedError['code']
  | ForbiddenOriginError['code']
  | NotFoundError['code']
  | PayloadTooLargeError['code']
  | RevisionConflictError['code']
  | RuleViolationError['code']
  | UserNotSetUpError['code']
  | InternalError['code'];

/**
 * - `unauthenticated`: no session (401). The person is sent to sign in.
 * - `revisionConflict`: another write came first, and this one was not made
 *   (409); or it was made and the database's answer was lost, which comes
 *   back the same way (ADR 0006 エラー). So it may have been saved: the
 *   reads are read again.
 * - `refused`: the request or the records' state does not allow it (400,
 *   403, 404, 413, 422). Sending it again gives the same answer. Among
 *   them `userNotSetUp`: the person has no settings yet (the first settings
 *   screen takes their place, #279).
 * - `failed`: anything else, which may have been saved too: the server
 *   failed (500), the network, a code this client does not know (ADR 0006
 *   互換の規則).
 */
export type Failure =
  | { readonly kind: 'unauthenticated' }
  | { readonly kind: 'revisionConflict' }
  | { readonly kind: 'refused'; readonly code: ErrorCode }
  | { readonly kind: 'failed' };

const REFUSED: ReadonlySet<string> = new Set<ErrorCode>([
  'validationFailed',
  'forbiddenOrigin',
  'notFound',
  'payloadTooLarge',
  'invalidInput',
  'invalidTransition',
  'recurringTaskCannotComplete',
  'userNotSetUp',
]);

/**
 * The generated client throws the error's body as it came (ADR 0006), or
 * what `fetch` threw when there was no answer.
 */
export function failureOf(error: unknown): Failure {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? error.code
      : undefined;
  if (code === 'unauthenticated') return { kind: 'unauthenticated' };
  if (code === 'revisionConflict') return { kind: 'revisionConflict' };
  if (typeof code === 'string' && REFUSED.has(code))
    return { kind: 'refused', code: code as ErrorCode };
  return { kind: 'failed' };
}
