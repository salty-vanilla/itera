// The contract's errors as the API and the browser mock write them (ADR
// 0006 エラー): Problem Details (RFC 9457) in `application/problem+json`.
// The shapes are the contract's (openapi/schemas/common.yaml); this module
// gives each type its status and its fixed title, and says where a part of
// a request that does not match is. Written by hand, not generated.
import type * as v from 'valibot';
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
  ValidationIssue,
} from './index';

export type { ValidationIssue };

/** The media type of every error response (RFC 9457 §3). */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** Every error body of the contract. */
export type Problem =
  | ValidationError
  | UnauthenticatedError
  | ForbiddenOriginError
  | NotFoundError
  | RevisionConflictError
  | PayloadTooLargeError
  | RuleViolationError
  | UserNotSetUpError
  | InternalError;

/** The identifier of a kind of problem, the one a client decides by. */
export type ProblemType = Problem['type'];

type StatusOf<T extends ProblemType> = Problem extends infer P
  ? P extends { readonly type: infer U; readonly status: infer S }
    ? T extends U
      ? S
      : never
    : never
  : never;

/**
 * The HTTP status and the title of each type. The title is the same for
 * every occurrence (RFC 9457 §3.1.3) and, like `detail`, is for developers.
 */
export const PROBLEMS: {
  readonly [T in ProblemType]: {
    readonly status: StatusOf<T>;
    readonly title: string;
  };
} = {
  '/problems/validation-failed': {
    status: 400,
    title: 'The request does not match the contract',
  },
  '/problems/unauthenticated': { status: 401, title: 'No valid session' },
  '/problems/forbidden-origin': {
    status: 403,
    title: "The write's origin is not the app's own",
  },
  '/problems/not-found': { status: 404, title: 'Not found' },
  '/problems/revision-conflict': {
    status: 409,
    title: 'Another write came first',
  },
  '/problems/payload-too-large': {
    status: 413,
    title: 'The body is too large',
  },
  '/problems/invalid-input': {
    status: 422,
    title: "The domain's rules do not accept the value",
  },
  '/problems/invalid-transition': {
    status: 422,
    title: "The record's state does not allow the operation",
  },
  '/problems/recurring-task-cannot-complete': {
    status: 422,
    title: 'A recurring Task cannot be completed',
  },
  '/problems/user-not-set-up': {
    status: 422,
    title: 'The person has no settings yet',
  },
  '/problems/internal-error': { status: 500, title: 'An unexpected failure' },
};

/**
 * The problem of each refusal of the domain, by the code of its
 * `DomainError`. The contract does not depend on packages/domain (ADR
 * 0007), so it names the codes here; the API and the browser mock look a
 * `DomainError` up by its code, which stops compiling when the domain has
 * a code this table does not name.
 */
export const DOMAIN_PROBLEMS = {
  notFound: '/problems/not-found',
  invalidInput: '/problems/invalid-input',
  invalidTransition: '/problems/invalid-transition',
  recurringTaskCannotComplete: '/problems/recurring-task-cannot-complete',
} as const satisfies Readonly<Record<string, PlainProblemType>>;

/** Any type but `validation-failed`, which says where (`validationProblem`). */
export type PlainProblemType = Exclude<
  ProblemType,
  '/problems/validation-failed'
>;

/** The body of a problem of the type; `detail` describes this occurrence. */
export function problemOf(type: PlainProblemType, detail: string): Problem {
  const { status, title } = PROBLEMS[type];
  return { type, title, status, detail } as Problem;
}

/** A 400 `validation-failed` for the places that do not match. */
export function validationProblem(
  errors: readonly [ValidationIssue, ...ValidationIssue[]],
): ValidationError {
  const { status, title } = PROBLEMS['/problems/validation-failed'];
  const detail = errors
    .map((issue) => `${placeOf(issue)}: ${issue.detail}`)
    .join('; ');
  return {
    type: '/problems/validation-failed',
    title,
    status,
    detail,
    errors: [...errors],
  };
}

function placeOf(issue: ValidationIssue): string {
  if (issue.pointer !== undefined) return `body ${issue.pointer}`;
  if (issue.parameter !== undefined) return `parameter ${issue.parameter}`;
  if (issue.header !== undefined) return `header ${issue.header}`;
  return 'request';
}

/** The parts of a request a contract's schema checks. */
export type RequestPart = 'path' | 'query' | 'body';

/**
 * The place `keys` names in a part of a request (ADR 0006 エラー): in the
 * body a JSON Pointer in its URI fragment form (RFC 6901 §6, `#/title`;
 * `#` is the whole body), in the path or the query the parameter's name.
 */
export function issueAt(
  part: RequestPart,
  keys: readonly PropertyKey[],
  detail: string,
): ValidationIssue {
  if (part === 'body') return { detail, pointer: pointerOf(keys) };
  const [name] = keys;
  return name === undefined ? { detail } : { detail, parameter: String(name) };
}

/** The issues Valibot found in a part of a request, one for each place. */
export function valibotIssues(
  part: RequestPart,
  issues: readonly [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]],
): [ValidationIssue, ...ValidationIssue[]] {
  const [first, ...rest] = issues.map((issue) =>
    issueAt(
      part,
      (issue.path ?? []).map((item) => item.key as PropertyKey),
      issue.message,
    ),
  );
  return [first!, ...rest];
}

/**
 * A lone surrogate, which JSON's keys may hold but a URI cannot carry
 * (`encodeURIComponent` throws on it): it becomes U+FFFD, so a body with
 * such a key is still told where it is wrong.
 */
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function pointerOf(keys: readonly PropertyKey[]): string {
  return `#${keys
    .map(
      (key) =>
        `/${encodeURIComponent(
          String(key)
            .replace(LONE_SURROGATE, '\uFFFD')
            .replaceAll('~', '~0')
            .replaceAll('/', '~1'),
        )}`,
    )
    .join('')}`;
}
