import {
  DOMAIN_PROBLEMS,
  PROBLEM_CONTENT_TYPE,
  problemOf,
  validationProblem,
  type PlainProblemType,
  type Problem,
  type ValidationIssue,
} from '@itera/api-contract/problems';
import type { DomainError } from '@itera/domain';
import { DrizzleQueryError } from 'drizzle-orm';
import type { Context } from 'hono';

/**
 * What a failure answers with: a problem's type and what happened this time
 * (`detail`), or the places of a request that does not match the contract
 * (ADR 0006 エラー).
 */
export type Failure =
  | { readonly type: PlainProblemType; readonly detail: string }
  | {
      readonly type: '/problems/validation-failed';
      readonly errors: readonly [ValidationIssue, ...ValidationIssue[]];
    };

/**
 * A failure the API answers with one of the contract's problems. Thrown
 * from anywhere in a request; `app.onError` turns it into the response.
 * `detail` is for developers (ADR 0006): it names what failed, never the
 * records.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(readonly failure: Failure) {
    super(
      failure.type === '/problems/validation-failed'
        ? failure.errors.map((issue) => issue.detail).join('; ')
        : failure.detail,
    );
  }

  static of(type: PlainProblemType, detail: string): ApiError {
    return new ApiError({ type, detail });
  }

  /** A 400 `validation-failed` at the places that do not match. */
  static invalid(
    ...errors: readonly [ValidationIssue, ...ValidationIssue[]]
  ): ApiError {
    return new ApiError({ type: '/problems/validation-failed', errors });
  }

  static fromDomain(error: DomainError): ApiError {
    return ApiError.of(DOMAIN_PROBLEMS[error.code], error.message);
  }
}

/** The problem's response: `application/problem+json` with its status. */
export function errorResponse(c: Context, failure: Failure) {
  const body: Problem =
    failure.type === '/problems/validation-failed'
      ? validationProblem(failure.errors)
      : problemOf(failure.type, failure.detail);
  return c.body(JSON.stringify(body), body.status, {
    'Content-Type': PROBLEM_CONTENT_TYPE,
  });
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
