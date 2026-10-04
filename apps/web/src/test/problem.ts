import {
  PROBLEM_CONTENT_TYPE,
  problemOf,
  type PlainProblemType,
} from '@itera/api-contract/problems';

/** An error response of the API (ADR 0006 エラー), as it answers it. */
export function problemResponse(type: PlainProblemType): Response {
  const body = problemOf(type, 'for developers');
  return new Response(JSON.stringify(body), {
    status: body.status,
    headers: { 'Content-Type': PROBLEM_CONTENT_TYPE },
  });
}
