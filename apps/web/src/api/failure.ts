// What a failed request means to the app. The API answers with `{ code,
// message }` (ADR 0006 エラー); the client decides by `code` alone, and the
// message, for developers, is never shown.
import type {
  ForbiddenOriginError,
  InternalError,
  NotFoundError,
  RevisionConflictError,
  RuleViolationError,
  UnauthenticatedError,
  ValidationError,
} from '@itera/api-contract';

export type ErrorCode =
  | ValidationError['code']
  | UnauthenticatedError['code']
  | ForbiddenOriginError['code']
  | NotFoundError['code']
  | RevisionConflictError['code']
  | RuleViolationError['code']
  | InternalError['code'];

/**
 * - `unauthenticated`: no session (401). The person is sent to sign in.
 * - `revisionConflict`: another write came first, and this one was not made
 *   (409). The reads are read again.
 * - `refused`: the request or the records' state does not allow it (400,
 *   403, 404, 422). Sending it again gives the same answer.
 * - `failed`: anything else: the server failed (500), the network, a code
 *   this client does not know (ADR 0006 互換の規則).
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
  'invalidInput',
  'invalidTransition',
  'recurringTaskCannotComplete',
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
