import { vCreateAreaBody } from '@itera/api-contract';
import {
  operations,
  type Change,
  type OperationName,
  type Operations,
} from '@itera/application';
import { Hono, type HonoRequest } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type * as v from 'valibot';
import type { AppEnv } from '../env';
import { ApiError, errorResponse } from './errors';
import type { Flow, Guards } from './flow';
import { validate } from './validate';

/**
 * The request body of each operation the API answers: the contract's
 * schema (`v<Name>Body`), or `null` for an operation without input. The
 * operation itself is `operations[name]` of packages/application, by the
 * same name (ADR 0006 経路の形). To answer another operation, add it here
 * and take it off `unimplementedOperations`.
 */
export const operationBodies: {
  readonly [N in OperationName]?: Parameters<Operations[N]> extends []
    ? null
    : v.GenericSchema;
} = {
  createArea: vCreateAreaBody,
};

/**
 * The contract's operations the API does not answer yet, by the Issue that
 * adds them. Every operation of the contract is in `operationBodies` or
 * here (operations.test.ts).
 */
export const unimplementedOperations: readonly OperationName[] = [
  // #267: the Backlog, Tasks and Areas.
  'renameArea',
  'archiveArea',
  'restoreArea',
  'createTask',
  'saveTask',
  'adoptSuggestion',
  'undoAdoption',
  'adoptEditedSuggestion',
  'rejectSuggestion',
  'undoRejection',
  'addSubtask',
  'setSubtaskDone',
  'setSubtaskEstimate',
  'archiveTask',
  'restoreTask',
  'completeTask',
  'undoCompleteTask',
  'addTaskToToday',
  'addTaskToWeek',
  'undoAddTaskToWeek',
  'setRecurrence',
  'endRecurrence',
  // #268: the Sprint, planning and running.
  'chooseTasks',
  'unchooseTasks',
  'unchooseTasksByTask',
  'setOccurrenceIncluded',
  'includeOccurrences',
  'excludeAllOccurrences',
  'createAndChooseTask',
  'setPlanningGoal',
  'setGoalLink',
  'setPlanningAvailableHours',
  'confirmSprint',
  'setRunningGoal',
  'setRunningAvailableHours',
  'undoPastDay',
  // #269: today.
  'chooseForToday',
  'startSelection',
  'deferSelection',
  'removeFromToday',
  'undoCloseSelection',
  'pauseSelection',
  'completeSelection',
  'undoCompleteSelection',
  'skipSelection',
  'undoSkipSelection',
  'recordSelectionActual',
  'noteInterrupt',
  'editInterrupt',
  'deleteInterrupt',
  'restoreInterrupt',
  'createTaskForToday',
  // #270: the Retro.
  'beginRetro',
  'assessGoal',
  'togglePin',
  'setReflection',
  'setImprovement',
  'draftCriterion',
  'setDraftPolicy',
  'dropCriterionDraft',
  'decideCriterion',
  'recordReviewActual',
  'completeRetro',
  'beginPlanning',
];

/** The largest request body an operation takes (ADR 0006 既知の制約). */
export const maxBodyBytes = 64 * 1024;

async function jsonBody(request: HonoRequest): Promise<unknown> {
  try {
    return await request.json<unknown>();
  } catch {
    throw new ApiError('validationFailed', 'body: not JSON.');
  }
}

/**
 * `POST /operations/{name}` for each operation in `operationBodies`. The
 * guards (authentication, the Origin check) run first, then the size limit
 * and the contract's validation. An operation that returns a value answers
 * 200 with it; one that returns nothing, 204.
 */
export function operationRoutes(flow: Flow, guards: Guards) {
  const routes = new Hono<AppEnv>();
  const limit = bodyLimit({
    maxSize: maxBodyBytes,
    onError: (c) =>
      errorResponse(
        c,
        'payloadTooLarge',
        `The body is larger than ${maxBodyBytes} bytes.`,
      ),
  });
  for (const [name, body] of Object.entries(operationBodies)) {
    routes.post(`/${name}`, guards.user, guards.origin, limit, async (c) => {
      const input =
        body === null
          ? undefined
          : validate(body, await jsonBody(c.req), 'body');
      // The contract's body is the operation's input, IDs and dates as
      // plain strings (packages/api-contract conformance.test.ts). The
      // schema has checked each ID's kind and each date, so they are the
      // domain's values.
      const operation = operations[name as OperationName] as (
        input: unknown,
      ) => Change<unknown>;
      const value = await flow.operate(c, operation(input));
      return value === undefined ? c.body(null, 204) : c.json(value, 200);
    });
  }
  return routes;
}
