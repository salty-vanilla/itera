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
import type { DomainError } from '@itera/domain';
import { DrizzleQueryError } from 'drizzle-orm';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Every error body of the contract: `{ code, message }` (ADR 0006 エラー). */
export type ErrorBody =
  | ValidationError
  | UnauthenticatedError
  | ForbiddenOriginError
  | NotFoundError
  | RevisionConflictError
  | PayloadTooLargeError
  | RuleViolationError
  | UserNotSetUpError
  | InternalError;

export type ErrorCode = ErrorBody['code'];

/** The HTTP status of each code (ADR 0006 エラー). */
const statusOf: Record<ErrorCode, ContentfulStatusCode> = {
  validationFailed: 400,
  unauthenticated: 401,
  forbiddenOrigin: 403,
  notFound: 404,
  revisionConflict: 409,
  payloadTooLarge: 413,
  invalidInput: 422,
  invalidTransition: 422,
  recurringTaskCannotComplete: 422,
  userNotSetUp: 422,
  internalError: 500,
};

/**
 * A failure the API answers with one of the contract's errors. Thrown from
 * anywhere in a request; `app.onError` turns it into the response. `message`
 * is for developers (ADR 0006): it names what failed, never the records.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }

  static fromDomain(error: DomainError): ApiError {
    return new ApiError(error.code, error.message);
  }
}

export function errorResponse(c: Context, code: ErrorCode, message: string) {
  const body = { code, message } as ErrorBody;
  return c.json(body, statusOf[code]);
}

type LoggedError = {
  readonly name: string;
  readonly message: string;
  readonly frames: readonly string[];
  readonly cause?: LoggedError;
};

/**
 * What Workers Logs keeps of an unexpected failure: the error's kind, its
 * message and where it was thrown. Never the request's body or the records
 * (ADR 0004). A failed query's message lists its parameters, which carry the
 * person's text, so only its cause (the database's own message) is kept.
 */
export function loggedError(error: unknown, depth = 0): LoggedError {
  if (!(error instanceof Error)) {
    return { name: typeof error, message: '(not an Error)', frames: [] };
  }
  const frames = (error.stack ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '));
  const cause =
    depth < 2 && error.cause !== undefined
      ? loggedError(error.cause, depth + 1)
      : undefined;
  const message =
    error instanceof DrizzleQueryError
      ? '(a failed query; see the cause)'
      : error.message;
  return {
    name: error.name,
    message,
    frames,
    ...(cause === undefined ? {} : { cause }),
  };
}
