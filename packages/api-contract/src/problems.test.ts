// The problems the API and the browser mock answer with are the contract's
// (ADR 0006 エラー).
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import * as contract from './index';
import {
  DOMAIN_PROBLEMS,
  issueAt,
  PROBLEMS,
  problemOf,
  validationProblem,
  valibotIssues,
  type ProblemType,
} from './problems';

const schemaOf: { readonly [T in ProblemType]: v.GenericSchema } = {
  '/problems/validation-failed': contract.vValidationError,
  '/problems/unauthenticated': contract.vUnauthenticatedError,
  '/problems/forbidden-origin': contract.vForbiddenOriginError,
  '/problems/not-found': contract.vNotFoundError,
  '/problems/revision-conflict': contract.vRevisionConflictError,
  '/problems/payload-too-large': contract.vPayloadTooLargeError,
  '/problems/invalid-input': contract.vRuleViolationError,
  '/problems/invalid-transition': contract.vRuleViolationError,
  '/problems/recurring-task-cannot-complete': contract.vRuleViolationError,
  '/problems/user-not-set-up': contract.vUserNotSetUpError,
  '/problems/idempotency-key-reused': contract.vIdempotencyKeyReusedError,
  '/problems/internal-error': contract.vInternalError,
};

describe('problemOf', () => {
  it('writes each type as the contract has it, with its status and title', () => {
    for (const type of Object.keys(PROBLEMS) as ProblemType[]) {
      if (type === '/problems/validation-failed') continue;
      const body = problemOf(type, 'what happened');
      expect(v.is(schemaOf[type], body), type).toBe(true);
      expect(body).toEqual({
        type,
        title: PROBLEMS[type].title,
        status: PROBLEMS[type].status,
        detail: 'what happened',
      });
    }
  });

  it('gives every refusal of the domain a type of the contract', () => {
    for (const type of Object.values(DOMAIN_PROBLEMS))
      expect(v.is(schemaOf[type], problemOf(type, ''))).toBe(true);
  });

  it('uses relative URI references in kebab-case (ADR 0006)', () => {
    for (const type of Object.keys(PROBLEMS))
      expect(type).toMatch(/^\/problems\/[a-z]+(-[a-z]+)*$/);
  });
});

describe('validationProblem', () => {
  it('lists each place, and says them all in the detail', () => {
    const body = validationProblem([
      { detail: 'not a string', pointer: '#/title' },
      { detail: 'not an ID', parameter: 'taskId' },
    ]);
    expect(v.is(contract.vValidationError, body)).toBe(true);
    expect(body).toMatchObject({ status: 400 });
    expect(body.detail).toBe(
      'body #/title: not a string; parameter taskId: not an ID',
    );
  });
});

describe('issueAt', () => {
  it('points into the body with a JSON Pointer in its URI fragment form', () => {
    expect(issueAt('body', [], 'x')).toEqual({ detail: 'x', pointer: '#' });
    expect(issueAt('body', ['previous', 'setAt'], 'x').pointer).toBe(
      '#/previous/setAt',
    );
    expect(issueAt('body', ['ids', 2], 'x').pointer).toBe('#/ids/2');
    // RFC 6901: `~` and `/` escaped, then what a fragment cannot carry.
    expect(issueAt('body', ['a/b~c d'], 'x').pointer).toBe('#/a~1b~0c%20d');
    // A key JSON may hold but a URI cannot: a lone surrogate.
    const lone = Object.keys(JSON.parse('{"\\ud800x":1}') as object)[0]!;
    expect(issueAt('body', [lone], 'x').pointer).toBe('#/%EF%BF%BDx');
  });

  it('names a path or query parameter', () => {
    expect(issueAt('path', ['taskId'], 'x')).toEqual({
      detail: 'x',
      parameter: 'taskId',
    });
    expect(issueAt('query', ['apply-criterion'], 'x').parameter).toBe(
      'apply-criterion',
    );
  });

  it('takes each issue Valibot found', () => {
    const result = v.safeParse(contract.vCreateTaskBody, { title: 1, x: 1 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(valibotIssues('body', result.issues).map((i) => i.pointer)).toEqual([
      '#/title',
      '#/x',
    ]);
  });
});
