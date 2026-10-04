// How the operations of packages/application travel as the contract's
// requests (ADR 0006 経路の形), both ways and in one place:
//
// - A surface is one HTTP method on one path, with one operationId. It
//   takes one operation, or several told apart by what the request carries
//   (which body properties, which query parameter, a constant's value) and
//   never by the person's records: the rules stay packages/domain's.
// - `requestOf` makes the request for an operation and its input (the web
//   app, from sending.ts). `surfaces[id].operation` reads a checked request
//   back into the operation and its input (services/api and the browser
//   mock).
//
// This module checks requests with the contract's Valibot schemas, so the
// web app's production code takes sending.ts's entry instead
// (`@itera/api-contract/sending`), which this one gives again with the way
// back. requests.test.ts holds the two ways to each other and to the
// contract.
import type { OperationInput, OperationName } from '@itera/application';
import * as v from 'valibot';
import * as c from './index';
import { issueAt, type RequestPart } from './problems';
import {
  IDEMPOTENCY_KEY_HEADER,
  RequestError,
  routes,
  type Plain,
  type Route,
  type SurfaceData,
  type SurfaceId,
} from './sending';

export * from './sending';

/** An operation of packages/application and its input. */
export type Call = {
  [N in OperationName]: {
    readonly name: N;
    readonly input: OperationInput<N>;
  };
}[OperationName];

/** A surface's request after its schemas have checked it. */
type Checked<S extends SurfaceId> = {
  readonly path: NonNullable<SurfaceData<S>['path']>;
  readonly query: NonNullable<SurfaceData<S>['query']>;
  readonly body: NonNullable<SurfaceData<S>['body']>;
};

/** A surface's route with the contract's schemas and its operations. */
export interface Surface<S extends SurfaceId = SurfaceId> extends Route<S> {
  /** The contract's schemas of the request's parts (`v<OperationId>Path` and so on). */
  readonly path?: v.GenericSchema;
  readonly query?: v.GenericSchema;
  readonly body?: v.GenericSchema;
  /** The operation the checked request names, and its input. */
  readonly operation: (request: Checked<S>) => Call;
}

/** What a surface adds to its route (`routes`). */
type Reading<S extends SurfaceId> = Omit<Surface<S>, keyof Route>;

/**
 * The operation and its input from a request's plain values. The schemas
 * have checked each ID's kind and each date (requests.test.ts), so the
 * plain strings are the domain's values.
 */
function call<N extends OperationName>(
  name: N,
  input: Plain<OperationInput<N>>,
): Call {
  return { name, input } as unknown as Call;
}

function surface<S extends SurfaceId>(id: S, spec: Reading<S>): Surface<S> {
  return { ...routes[id], ...spec };
}

/** Each write surface of the contract by its operationId. */
export const surfaces: { readonly [S in SurfaceId]: Surface<S> } = {
  // ---------------------------------------------------------------- Area
  createArea: surface('createArea', {
    body: c.vCreateAreaBody,
    operation: ({ body }) => call('createArea', body),
  }),
  renameArea: surface('renameArea', {
    path: c.vRenameAreaPath,
    body: c.vRenameAreaBody,
    operation: ({ path, body }) => call('renameArea', { ...path, ...body }),
  }),
  archiveArea: surface('archiveArea', {
    path: c.vArchiveAreaPath,
    operation: ({ path }) => call('archiveArea', path),
  }),
  restoreArea: surface('restoreArea', {
    path: c.vRestoreAreaPath,
    operation: ({ path }) => call('restoreArea', path),
  }),

  // ---------------------------------------------------------------- Task
  createTask: surface('createTask', {
    body: c.vCreateTaskBody,
    operation: ({ body }) => call('createTask', body),
  }),
  saveTask: surface('saveTask', {
    path: c.vSaveTaskPath,
    body: c.vSaveTaskBody,
    operation: ({ path: { taskId }, body: { estimate, ...update } }) =>
      call('saveTask', {
        taskId,
        update,
        ...(estimate === undefined ? {} : { estimate }),
      }),
  }),
  archiveTask: onTask('archiveTask', c.vArchiveTaskPath),
  restoreTask: onTask('restoreTask', c.vRestoreTaskPath),
  completeTask: onTask('completeTask', c.vCompleteTaskPath),
  undoCompleteTask: onTask('undoCompleteTask', c.vUndoCompleteTaskPath),
  setRecurrence: surface('setRecurrence', {
    path: c.vSetRecurrencePath,
    body: c.vSetRecurrenceBody,
    operation: ({ path, body }) => call('setRecurrence', { ...path, ...body }),
  }),
  endRecurrence: surface('endRecurrence', {
    path: c.vEndRecurrencePath,
    operation: ({ path }) => call('endRecurrence', path),
  }),
  addSubtask: surface('addSubtask', {
    path: c.vAddSubtaskPath,
    body: c.vAddSubtaskBody,
    operation: ({ path, body }) => call('addSubtask', { ...path, ...body }),
  }),
  updateSubtask: surface('updateSubtask', {
    path: c.vUpdateSubtaskPath,
    body: c.vUpdateSubtaskBody,
    operation: ({ path, body }) =>
      'done' in body
        ? call('setSubtaskDone', { ...path, done: body.done })
        : call('setSubtaskEstimate', { ...path, hours: body.hours }),
  }),
  adoptEstimateSuggestion: surface('adoptEstimateSuggestion', {
    path: c.vAdoptEstimateSuggestionPath,
    body: c.vAdoptEstimateSuggestionBody,
    operation: ({ path, body }) =>
      'bound' in body
        ? call('adoptSuggestion', { ...path, bound: body.bound })
        : call('adoptEditedSuggestion', { ...path, hours: body.hours }),
  }),
  undoAdoption: surface('undoAdoption', {
    path: c.vUndoAdoptionPath,
    body: c.vUndoAdoptionBody,
    operation: ({ path, body }) => call('undoAdoption', { ...path, ...body }),
  }),
  rejectSuggestion: surface('rejectSuggestion', {
    path: c.vRejectSuggestionPath,
    operation: ({ path }) => call('rejectSuggestion', path),
  }),
  undoRejection: surface('undoRejection', {
    path: c.vUndoRejectionPath,
    operation: ({ path }) => call('undoRejection', path),
  }),

  // -------------------------------------------------------------- Sprint
  beginPlanning: surface('beginPlanning', {
    operation: () => call('beginPlanning', undefined),
  }),
  setAvailableHours: surface('setAvailableHours', {
    path: c.vSetAvailableHoursPath,
    body: c.vSetAvailableHoursBody,
    operation: ({ path, body }) =>
      call('setAvailableHours', { ...path, hours: body.availableHours }),
  }),
  confirmSprint: surface('confirmSprint', {
    path: c.vConfirmSprintPath,
    body: c.vConfirmSprintBody,
    operation: ({ path, body }) => call('confirmSprint', { ...path, ...body }),
  }),
  updateGoal: surface('updateGoal', {
    path: c.vUpdateGoalPath,
    body: c.vUpdateGoalBody,
    operation: ({ path, body }) =>
      'text' in body
        ? call('setGoal', { ...path, text: body.text })
        : call('assessGoal', { ...path, assessment: body.assessment }),
  }),
  addToSprint: surface('addToSprint', {
    path: c.vAddToSprintPath,
    body: c.vAddToSprintBody,
    operation: ({ path, body }) =>
      'taskIds' in body
        ? call('addSprintTasks', { ...path, taskIds: body.taskIds })
        : call('createAndChooseTask', { ...path, ...body }),
  }),
  removeSprintTasks: surface('removeSprintTasks', {
    path: c.vRemoveSprintTasksPath,
    query: c.vRemoveSprintTasksQuery,
    operation: ({ path, query }) =>
      call('removeSprintTasks', { ...path, sprintTaskIds: query.ids }),
  }),
  removeSprintTask: surface('removeSprintTask', {
    path: c.vRemoveSprintTaskPath,
    operation: ({ path: { sprintId, sprintTaskId } }) =>
      call('removeSprintTasks', { sprintId, sprintTaskIds: [sprintTaskId] }),
  }),
  setGoalLink: surface('setGoalLink', {
    path: c.vSetGoalLinkPath,
    body: c.vSetGoalLinkBody,
    operation: ({ path, body }) => call('setGoalLink', { ...path, ...body }),
  }),
  excludeAllOccurrences: surface('excludeAllOccurrences', {
    path: c.vExcludeAllOccurrencesPath,
    operation: ({ path }) => call('excludeAllOccurrences', path),
  }),
  includeOccurrences: surface('includeOccurrences', {
    path: c.vIncludeOccurrencesPath,
    body: c.vIncludeOccurrencesBody,
    operation: ({ path, body }) =>
      call('includeOccurrences', { ...path, ...body }),
  }),
  includeOccurrence: surface('includeOccurrence', {
    path: c.vIncludeOccurrencePath,
    operation: ({ path }) =>
      call('setOccurrenceIncluded', { ...path, included: true }),
  }),
  excludeOccurrence: surface('excludeOccurrence', {
    path: c.vExcludeOccurrencePath,
    operation: ({ path }) =>
      call('setOccurrenceIncluded', { ...path, included: false }),
  }),

  // --------------------------------------------------------------- Today
  chooseForDay: surface('chooseForDay', {
    path: c.vChooseForDayPath,
    body: c.vChooseForDayBody,
    operation: ({ path, body }) => {
      if ('sprintTaskId' in body)
        return call('chooseForToday', { ...path, ...body });
      if ('taskId' in body) return call('addTaskToToday', { ...path, ...body });
      return call('createTaskForToday', { ...path, ...body });
    },
  }),
  startSelection: onSelection('startSelection', c.vStartSelectionPath),
  pauseSelection: surface('pauseSelection', {
    path: c.vPauseSelectionPath,
    body: c.vPauseSelectionBody,
    operation: ({ path, body }) => call('pauseSelection', { ...path, ...body }),
  }),
  deferSelection: onSelection('deferSelection', c.vDeferSelectionPath),
  undoDeferSelection: onSelection(
    'undoDeferSelection',
    c.vUndoDeferSelectionPath,
  ),
  removeFromToday: onSelection('removeFromToday', c.vRemoveFromTodayPath),
  undoRemoveFromToday: onSelection(
    'undoRemoveFromToday',
    c.vUndoRemoveFromTodayPath,
  ),
  completeSelection: onSelection('completeSelection', c.vCompleteSelectionPath),
  undoCompleteSelection: onSelection(
    'undoCompleteSelection',
    c.vUndoCompleteSelectionPath,
  ),
  skipSelection: onSelection('skipSelection', c.vSkipSelectionPath),
  undoSkipSelection: onSelection('undoSkipSelection', c.vUndoSkipSelectionPath),
  recordActualTime: surface('recordActualTime', {
    path: c.vRecordActualTimePath,
    body: c.vRecordActualTimeBody,
    operation: ({ path, body }) =>
      call('recordActualTime', { ...path, ...body }),
  }),
  noteInterrupt: surface('noteInterrupt', {
    path: c.vNoteInterruptPath,
    body: c.vNoteInterruptBody,
    operation: ({ path, body }) => call('noteInterrupt', { ...path, ...body }),
  }),
  editInterrupt: surface('editInterrupt', {
    path: c.vEditInterruptPath,
    body: c.vEditInterruptBody,
    operation: ({ path, body: { text, minutes } }) =>
      call('editInterrupt', {
        ...path,
        text,
        ...(minutes === null ? {} : { minutes }),
      }),
  }),
  deleteInterrupt: surface('deleteInterrupt', {
    path: c.vDeleteInterruptPath,
    operation: ({ path }) => call('deleteInterrupt', path),
  }),
  restoreInterrupt: surface('restoreInterrupt', {
    path: c.vRestoreInterruptPath,
    body: c.vRestoreInterruptBody,
    operation: ({ path: { sprintId, interruptNoteId }, body }) =>
      call('restoreInterrupt', {
        sprintId,
        note: { id: interruptNoteId, ...body },
      }),
  }),

  // --------------------------------------------------------------- Retro
  beginRetro: surface('beginRetro', {
    path: c.vBeginRetroPath,
    operation: ({ path }) => call('beginRetro', path),
  }),
  updateRetro: surface('updateRetro', {
    path: c.vUpdateRetroPath,
    body: c.vUpdateRetroBody,
    operation: ({ path, body }) =>
      'reflection' in body
        ? call('setReflection', { ...path, text: body.reflection })
        : call('setImprovement', { ...path, text: body.improvement }),
  }),
  completeRetro: surface('completeRetro', {
    path: c.vCompleteRetroPath,
    operation: ({ path }) => call('completeRetro', path),
  }),
  pinFact: surface('pinFact', {
    path: c.vPinFactPath,
    operation: ({ path: { sprintId, pin } }) =>
      call('pinFact', { sprintId, pin: retroPin(pin) }),
  }),
  unpinFact: surface('unpinFact', {
    path: c.vUnpinFactPath,
    operation: ({ path: { sprintId, pin } }) =>
      call('unpinFact', { sprintId, pin: retroPin(pin) }),
  }),
  decideCriterion: surface('decideCriterion', {
    path: c.vDecideCriterionPath,
    body: c.vDecideCriterionBody,
    operation: ({ path, body }) =>
      call('decideCriterion', { ...path, decision: body.retroDecision }),
  }),

  // -------------------------------------------------- Planning criteria
  draftCriterion: surface('draftCriterion', {
    body: c.vDraftCriterionBody,
    operation: ({ body: { sourceSprintId, policy } }) =>
      call('draftCriterion', { sprintId: sourceSprintId, policy }),
  }),
  setDraftPolicy: surface('setDraftPolicy', {
    path: c.vSetDraftPolicyPath,
    body: c.vSetDraftPolicyBody,
    operation: ({ path, body }) => call('setDraftPolicy', { ...path, ...body }),
  }),
  dropCriterionDraft: surface('dropCriterionDraft', {
    path: c.vDropCriterionDraftPath,
    operation: ({ path }) => call('dropCriterionDraft', path),
  }),
};

/**
 * The write of the person's settings (`PUT /me/settings`). It is a surface
 * of the contract that no operation of packages/application takes: the
 * operations run on the person's records, and the settings are what makes
 * the records possible (`settingsChange`, run by the server and the
 * browser mock). So it stands outside `surfaces`.
 */
export const settingsSurface = {
  method: 'PUT',
  url: '/me/settings' satisfies c.SetSettingsData['url'],
  /** The first time makes them; after that they are written again. */
  status: { created: 201, written: 204 } satisfies Record<
    string,
    keyof c.SetSettingsResponses
  >,
  body: c.vSetSettingsBody,
} as const;

/** A request's parts as the server or the browser mock received them. */
export type ReceivedRequest = {
  /** The path's values by name (`{ areaId: 'area_…' }`). */
  readonly path: Readonly<Record<string, string>>;
  /** Each query name with all its values. */
  readonly query: Readonly<Record<string, readonly string[]>>;
  /** Reads the JSON body; only called for a surface that takes one. */
  readonly body: () => Promise<unknown>;
};

/**
 * Checks one part of a request with the surface's schema and gives the
 * schema's output, or throws the receiver's own error (400).
 */
export type CheckPart = (
  schema: v.GenericSchema,
  value: unknown,
  part: RequestPart,
) => unknown;

/**
 * The operation a received request names, the same steps for the server
 * and the browser mock: the path's values, the query (`queryInput`) and the
 * body are checked in that order with the surface's schemas by `check`,
 * then the surface names the operation. Throws `RequestError` for a
 * request no operation takes.
 */
export async function readRequest(
  surface: Surface,
  received: ReceivedRequest,
  check: CheckPart,
): Promise<Call> {
  const parts: Record<string, unknown> = {};
  if (surface.path !== undefined)
    parts.path = check(surface.path, received.path, 'path');
  if (surface.query !== undefined)
    parts.query = check(
      surface.query,
      queryInput(surface.query, received.query),
      'query',
    );
  if (surface.body !== undefined)
    parts.body = check(surface.body, await received.body(), 'body');
  return surface.operation(parts as Parameters<Surface['operation']>[0]);
}

type SelectionSurface =
  | 'startSelection'
  | 'deferSelection'
  | 'undoDeferSelection'
  | 'removeFromToday'
  | 'undoRemoveFromToday'
  | 'completeSelection'
  | 'undoCompleteSelection'
  | 'skipSelection'
  | 'undoSkipSelection';

/**
 * `POST /sprints/{sprintId}/daily-selections/{selectionId}/<verb>`: a
 * change of a day's choice, the operation of the same name.
 */
function onSelection<S extends SelectionSurface>(
  name: S,
  path: v.GenericSchema,
): Surface<S> {
  return surface(name, {
    path,
    operation: ({ path: { sprintId, selectionId } }) =>
      call(name, { sprintId, selectionId } as Plain<OperationInput<S>>),
  });
}

type TaskVerbSurface =
  'archiveTask' | 'restoreTask' | 'completeTask' | 'undoCompleteTask';

/** `POST /tasks/{taskId}/<verb>`: a change of a Task's state. */
function onTask<S extends TaskVerbSurface>(
  name: S,
  path: v.GenericSchema,
): Surface<S> {
  return surface(name, {
    path,
    operation: ({ path: { taskId } }) =>
      call(name, { taskId } as Plain<OperationInput<S>>),
  });
}

/**
 * The fact a pin's path value names: the kind of its ID (TypeID's prefix,
 * as the path's schema has checked), the Area's for a Goal, or the hours.
 */
function retroPin(pin: string): Plain<OperationInput<'pinFact'>['pin']> {
  if (pin === 'available-hours') return { kind: 'availableHours' };
  const kinds = [
    ['sprintTask', c.vSprintTaskId],
    ['dailySelection', c.vDailySelectionId],
    ['occurrence', c.vOccurrenceId],
    ['interrupt', c.vInterruptNoteId],
    ['goal', c.vAreaId],
  ] as const;
  const kind = kinds.find(([, schema]) => v.is(schema, pin))?.[0];
  if (kind === undefined)
    throw new RequestError(issueAt('path', ['pin'], `not a fact: ${pin}`));
  return { kind, id: pin };
}

/**
 * The key a received write is named by: the UUID of the header, in
 * lowercase, so that a key sent again in another case is the same key.
 * Parameters after it are ignored (RFC 9651 §2.3). Throws `RequestError`
 * (400) when there is no header or it is not a UUID in a Structured Field
 * String.
 */
export function readIdempotencyKey(value: string | null | undefined): string {
  const header = IDEMPOTENCY_KEY_HEADER;
  if (value === null || value === undefined)
    throw new RequestError({ header, detail: 'required for every write.' });
  if (!v.is(c.vIdempotencyKey, value))
    throw new RequestError({
      header,
      detail: 'not a UUID as a Structured Field String ("…").',
    });
  return value.slice(1, 37).toLowerCase();
}

/** A received write's condition, as packages/application checks it. */
export type ReceivedCondition = {
  /** The entity-tags of `If-Match`, or `*` for any. */
  readonly ifMatch?: readonly string[] | '*';
  readonly ifNoneMatch?: '*';
};

/**
 * The condition of a received write, from its `If-Match` and
 * `If-None-Match` (`undefined` without either). Throws `RequestError` (400)
 * when one is not in the form the contract takes. Whether the write needs
 * one is packages/application's to say (`checkCondition`).
 */
export function readCondition(headers: {
  readonly ifMatch: string | null | undefined;
  readonly ifNoneMatch: string | null | undefined;
}): ReceivedCondition | undefined {
  const { ifMatch, ifNoneMatch } = headers;
  if (ifMatch != null && !v.is(c.vEntityTagList, ifMatch))
    throw new RequestError({
      header: 'If-Match',
      detail: 'not `*` or a list of entity-tags ("…").',
    });
  if (ifNoneMatch != null && !v.is(c.vAnyEntityTag, ifNoneMatch))
    throw new RequestError({
      header: 'If-None-Match',
      detail: 'only `*` is taken.',
    });
  if (ifMatch == null && ifNoneMatch == null) return undefined;
  return {
    ...(ifMatch == null
      ? {}
      : {
          ifMatch:
            ifMatch === '*'
              ? '*'
              : [...ifMatch.matchAll(/(?:W\/)?"[^"]*"/g)].map((m) => m[0]),
        }),
    ...(ifNoneMatch == null ? {} : { ifNoneMatch: '*' as const }),
  };
}

// ------------------------------------------------------------ the query

type Node = {
  readonly type: string;
  readonly entries?: Readonly<Record<string, v.GenericSchema>>;
  readonly wrapped?: v.GenericSchema;
  readonly item?: v.GenericSchema;
};

/**
 * A query string as the query schema declares it, for the schema to check
 * (reads and writes alike). Values arrive as strings, a name given again
 * as more of them: a list takes them all, any other name one, and a number
 * or a boolean is turned into its type first (ADR 0006). What does not fit
 * stays as it came and fails the check.
 */
export function queryInput(
  schema: v.GenericSchema,
  query: Readonly<Record<string, readonly string[]>>,
): Record<string, unknown> {
  const entries = (schema as unknown as Node).entries ?? {};
  return Object.fromEntries(
    Object.entries(query).map(([key, texts]) => {
      const entry = entries[key];
      if (entry === undefined) return [key, texts];
      const node = unwrapped(entry);
      if (node.type === 'array')
        return [key, texts.map((text) => converted(node.item!, text))];
      return [key, texts.length === 1 ? converted(entry, texts[0]!) : texts];
    }),
  );
}

function unwrapped(schema: v.GenericSchema): Node {
  let node = schema as unknown as Node;
  while (node.wrapped !== undefined) node = node.wrapped as unknown as Node;
  return node;
}

function converted(schema: v.GenericSchema, text: string): unknown {
  const node = unwrapped(schema);
  // Decimal digits only: `Number` would also take ` 2`, `0x10` and `1e1`.
  if (node.type === 'number') {
    return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
  }
  if (node.type === 'boolean') {
    if (text === 'true') return true;
    if (text === 'false') return false;
  }
  return text;
}
