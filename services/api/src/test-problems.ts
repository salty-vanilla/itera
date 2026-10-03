// What every error response of the API is (ADR 0006 エラー), for the
// tests: `application/problem+json`, the body's `status` the same as the
// response's, and the contract's schema of that status.
import * as contract from '@itera/api-contract';
import {
  PROBLEM_CONTENT_TYPE,
  type Problem,
} from '@itera/api-contract/problems';
import * as v from 'valibot';
import { expect } from 'vitest';

const schemas: Readonly<Record<number, v.GenericSchema>> = {
  400: contract.vValidationError,
  401: contract.vUnauthenticatedError,
  403: contract.vForbiddenOriginError,
  404: contract.vNotFoundError,
  409: contract.vRevisionConflictError,
  413: contract.vPayloadTooLargeError,
  422: v.union([contract.vRuleViolationError, contract.vUserNotSetUpError]),
  500: contract.vInternalError,
};

/** The response's problem, after checking that it is the contract's. */
export async function problemIn(response: Response): Promise<Problem> {
  expect(response.headers.get('Content-Type')).toBe(PROBLEM_CONTENT_TYPE);
  const body: unknown = await response.json();
  const schema = schemas[response.status];
  expect(schema, `a status the contract has: ${response.status}`).toBeDefined();
  const result = v.safeParse(schema!, body);
  expect(result.issues, JSON.stringify(body)).toBeUndefined();
  expect(body).toMatchObject({ status: response.status });
  return body as Problem;
}
