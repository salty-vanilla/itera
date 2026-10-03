// How the operations of packages/application travel as the contract's
// requests (ADR 0006 経路の形), both ways and in one place:
//
// - A surface is one HTTP method on one path, with one operationId. It
//   takes one operation, or several told apart by what the request carries
//   (which body properties, which query parameter, a constant's value) and
//   never by the person's records: the rules stay packages/domain's.
// - `requestOf` makes the request for an operation and its input (the web
//   app). `surfaces[id].operation` reads a checked request back into the
//   operation and its input (services/api and the browser mock).
//
// requests.test.ts holds the two ways to each other and to the contract.
import type {
  OperationInput,
  OperationName,
  OperationOutput,
} from '@itera/application';
import * as v from 'valibot';
import * as c from './index';

/**
 * A type as JSON carries it: IDs, dates and other branded strings become
 * `string`, `readonly` goes, and intersections become one object. The
 * generated types have no brands and no `readonly`; this makes both sides
 * comparable.
 */
export type Plain<T> = T extends string
  ? [Exclude<keyof T, keyof string>] extends [never]
    ? T
    : string
  : T extends number | boolean | null | undefined | void
    ? T
    : T extends readonly (infer U)[]
      ? Plain<U>[]
      : T extends object
        ? { -readonly [K in keyof T as PlainKey<K>]: Plain<T[K]> }
        : T;

type PlainKey<K> = K extends string ? Plain<K> : K;

/** Each surface's request, as generated (`<OperationId>Data`). */
type Datas = {
  createArea: c.CreateAreaData;
  updateArea: c.UpdateAreaData;
  quickAddTask: c.QuickAddTaskData;
  updateTask: c.UpdateTaskData;
  completeTask: c.CompleteTaskData;
  undoCompleteTask: c.UndoCompleteTaskData;
  setRecurrence: c.SetRecurrenceData;
  endRecurrence: c.EndRecurrenceData;
  addSubtask: c.AddSubtaskData;
  updateSubtask: c.UpdateSubtaskData;
  adoptEstimateSuggestion: c.AdoptEstimateSuggestionData;
  undoAdoption: c.UndoAdoptionData;
  rejectSuggestion: c.RejectSuggestionData;
  undoRejection: c.UndoRejectionData;
  beginPlanning: c.BeginPlanningData;
  setPlanningAvailableHours: c.SetPlanningAvailableHoursData;
  confirmSprint: c.ConfirmSprintData;
  setPlanningGoal: c.SetPlanningGoalData;
  chooseTasks: c.ChooseTasksData;
  unchoosePlanningTasks: c.UnchoosePlanningTasksData;
  setGoalLink: c.SetGoalLinkData;
  excludeAllOccurrences: c.ExcludeAllOccurrencesData;
  setOccurrenceIncluded: c.SetOccurrenceIncludedData;
  includeOccurrences: c.IncludeOccurrencesData;
  createDailySelection: c.CreateDailySelectionData;
  startSelection: c.StartSelectionData;
  pauseSelection: c.PauseSelectionData;
  deferSelection: c.DeferSelectionData;
  removeFromToday: c.RemoveFromTodayData;
  completeSelection: c.CompleteSelectionData;
  skipSelection: c.SkipSelectionData;
  undoCloseSelection: c.UndoCloseSelectionData;
  undoCompleteSelection: c.UndoCompleteSelectionData;
  undoSkipSelection: c.UndoSkipSelectionData;
  recordSelectionActual: c.RecordSelectionActualData;
  noteInterrupt: c.NoteInterruptData;
  editInterrupt: c.EditInterruptData;
  deleteInterrupt: c.DeleteInterruptData;
  restoreInterrupt: c.RestoreInterruptData;
  setRunningAvailableHours: c.SetRunningAvailableHoursData;
  setRunningGoal: c.SetRunningGoalData;
  addTaskToWeek: c.AddTaskToWeekData;
  undoAddTaskToWeek: c.UndoAddTaskToWeekData;
  undoPastDay: c.UndoPastDayData;
  updateRetro: c.UpdateRetroData;
  beginRetro: c.BeginRetroData;
  completeRetro: c.CompleteRetroData;
  assessGoal: c.AssessGoalData;
  pinFact: c.PinFactData;
  unpinFact: c.UnpinFactData;
  draftCriterion: c.DraftCriterionData;
  setDraftPolicy: c.SetDraftPolicyData;
  dropCriterionDraft: c.DropCriterionDraftData;
  recordReviewActual: c.RecordReviewActualData;
};

/** Each surface's responses by status, as generated (`<OperationId>Responses`). */
type Responses = {
  createArea: c.CreateAreaResponses;
  updateArea: c.UpdateAreaResponses;
  quickAddTask: c.QuickAddTaskResponses;
  updateTask: c.UpdateTaskResponses;
  completeTask: c.CompleteTaskResponses;
  undoCompleteTask: c.UndoCompleteTaskResponses;
  setRecurrence: c.SetRecurrenceResponses;
  endRecurrence: c.EndRecurrenceResponses;
  addSubtask: c.AddSubtaskResponses;
  updateSubtask: c.UpdateSubtaskResponses;
  adoptEstimateSuggestion: c.AdoptEstimateSuggestionResponses;
  undoAdoption: c.UndoAdoptionResponses;
  rejectSuggestion: c.RejectSuggestionResponses;
  undoRejection: c.UndoRejectionResponses;
  beginPlanning: c.BeginPlanningResponses;
  setPlanningAvailableHours: c.SetPlanningAvailableHoursResponses;
  confirmSprint: c.ConfirmSprintResponses;
  setPlanningGoal: c.SetPlanningGoalResponses;
  chooseTasks: c.ChooseTasksResponses;
  unchoosePlanningTasks: c.UnchoosePlanningTasksResponses;
  setGoalLink: c.SetGoalLinkResponses;
  excludeAllOccurrences: c.ExcludeAllOccurrencesResponses;
  setOccurrenceIncluded: c.SetOccurrenceIncludedResponses;
  includeOccurrences: c.IncludeOccurrencesResponses;
  createDailySelection: c.CreateDailySelectionResponses;
  startSelection: c.StartSelectionResponses;
  pauseSelection: c.PauseSelectionResponses;
  deferSelection: c.DeferSelectionResponses;
  removeFromToday: c.RemoveFromTodayResponses;
  completeSelection: c.CompleteSelectionResponses;
  skipSelection: c.SkipSelectionResponses;
  undoCloseSelection: c.UndoCloseSelectionResponses;
  undoCompleteSelection: c.UndoCompleteSelectionResponses;
  undoSkipSelection: c.UndoSkipSelectionResponses;
  recordSelectionActual: c.RecordSelectionActualResponses;
  noteInterrupt: c.NoteInterruptResponses;
  editInterrupt: c.EditInterruptResponses;
  deleteInterrupt: c.DeleteInterruptResponses;
  restoreInterrupt: c.RestoreInterruptResponses;
  setRunningAvailableHours: c.SetRunningAvailableHoursResponses;
  setRunningGoal: c.SetRunningGoalResponses;
  addTaskToWeek: c.AddTaskToWeekResponses;
  undoAddTaskToWeek: c.UndoAddTaskToWeekResponses;
  undoPastDay: c.UndoPastDayResponses;
  updateRetro: c.UpdateRetroResponses;
  beginRetro: c.BeginRetroResponses;
  completeRetro: c.CompleteRetroResponses;
  assessGoal: c.AssessGoalResponses;
  pinFact: c.PinFactResponses;
  unpinFact: c.UnpinFactResponses;
  draftCriterion: c.DraftCriterionResponses;
  setDraftPolicy: c.SetDraftPolicyResponses;
  dropCriterionDraft: c.DropCriterionDraftResponses;
  recordReviewActual: c.RecordReviewActualResponses;
};

export type { OperationName };

/**
 * An operation's input as a client gives it, and its output as the
 * response carries it: IDs and dates are the contract's strings.
 */
export type PlainInput<N extends OperationName> = Plain<OperationInput<N>>;
export type PlainOutput<N extends OperationName> = Plain<OperationOutput<N>>;

/** The operationId of a surface: a write of the contract. */
export type SurfaceId = keyof Datas;

/** The request's parts of a surface, as the generated client takes them. */
export type RequestParts<S extends SurfaceId> = Omit<Datas[S], 'url'>;

/** The response of a surface when it went through. */
export type SurfaceResponse<S extends SurfaceId> =
  Responses[S][keyof Responses[S]];

/** An operation of packages/application and its input. */
export type Call = {
  [N in OperationName]: {
    readonly name: N;
    readonly input: OperationInput<N>;
  };
}[OperationName];

/** A surface's request after its schemas have checked it. */
type Checked<S extends SurfaceId> = {
  readonly path: NonNullable<Datas[S]['path']>;
  readonly query: NonNullable<Datas[S]['query']>;
  readonly body: NonNullable<Datas[S]['body']>;
};

export interface Surface<S extends SurfaceId = SurfaceId> {
  readonly method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** The path under `/api`, `{name}` for a path value. */
  readonly url: Datas[S]['url'];
  /** The status when it went through: 201 made something, 204 returns nothing. */
  readonly status: keyof Responses[S] & (200 | 201 | 204);
  /** The contract's schemas of the request's parts (`v<OperationId>Path` and so on). */
  readonly path?: v.GenericSchema;
  readonly query?: v.GenericSchema;
  readonly body?: v.GenericSchema;
  /** The operation the checked request names, and its input. */
  readonly operation: (request: Checked<S>) => Call;
}

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

function surface<S extends SurfaceId>(_: S, spec: Surface<S>): Surface<S> {
  return spec;
}

/** Each write surface of the contract by its operationId. */
export const surfaces: { readonly [S in SurfaceId]: Surface<S> } = {
  // ---------------------------------------------------------------- Area
  createArea: surface('createArea', {
    method: 'POST',
    url: '/areas',
    status: 201,
    body: c.vCreateAreaBody,
    operation: ({ body }) => call('createArea', body),
  }),
  updateArea: surface('updateArea', {
    method: 'PATCH',
    url: '/areas/{areaId}',
    status: 204,
    path: c.vUpdateAreaPath,
    body: c.vUpdateAreaBody,
    operation: ({ path: { areaId }, body }) => {
      if ('name' in body)
        return call('renameArea', { areaId, name: body.name });
      return call(body.archived ? 'archiveArea' : 'restoreArea', { areaId });
    },
  }),

  // ---------------------------------------------------------------- Task
  quickAddTask: surface('quickAddTask', {
    method: 'POST',
    url: '/tasks',
    status: 201,
    body: c.vQuickAddTaskBody,
    operation: ({ body: { addTo, ...task } }) =>
      call(
        addTo === undefined
          ? 'createTask'
          : addTo === 'planning'
            ? 'createAndChooseTask'
            : 'createTaskForToday',
        task,
      ),
  }),
  updateTask: surface('updateTask', {
    method: 'PATCH',
    url: '/tasks/{taskId}',
    status: 204,
    path: c.vUpdateTaskPath,
    body: c.vUpdateTaskBody,
    operation: ({ path: { taskId }, body }) => {
      if ('archived' in body)
        return call(body.archived ? 'archiveTask' : 'restoreTask', { taskId });
      const { estimate, ...update } = body;
      return call('saveTask', {
        taskId,
        update,
        ...(estimate === undefined ? {} : { estimate }),
      });
    },
  }),
  completeTask: surface('completeTask', {
    method: 'PUT',
    url: '/tasks/{taskId}/completion',
    status: 204,
    path: c.vCompleteTaskPath,
    operation: ({ path }) => call('completeTask', path),
  }),
  undoCompleteTask: surface('undoCompleteTask', {
    method: 'DELETE',
    url: '/tasks/{taskId}/completion',
    status: 204,
    path: c.vUndoCompleteTaskPath,
    operation: ({ path }) => call('undoCompleteTask', path),
  }),
  setRecurrence: surface('setRecurrence', {
    method: 'PUT',
    url: '/tasks/{taskId}/recurrence',
    status: 200,
    path: c.vSetRecurrencePath,
    body: c.vSetRecurrenceBody,
    operation: ({ path, body }) => call('setRecurrence', { ...path, ...body }),
  }),
  endRecurrence: surface('endRecurrence', {
    method: 'DELETE',
    url: '/tasks/{taskId}/recurrence',
    status: 200,
    path: c.vEndRecurrencePath,
    operation: ({ path }) => call('endRecurrence', path),
  }),
  addSubtask: surface('addSubtask', {
    method: 'POST',
    url: '/tasks/{taskId}/subtasks',
    status: 201,
    path: c.vAddSubtaskPath,
    body: c.vAddSubtaskBody,
    operation: ({ path, body }) => call('addSubtask', { ...path, ...body }),
  }),
  updateSubtask: surface('updateSubtask', {
    method: 'PATCH',
    url: '/tasks/{taskId}/subtasks/{subtaskId}',
    status: 204,
    path: c.vUpdateSubtaskPath,
    body: c.vUpdateSubtaskBody,
    operation: ({ path, body }) =>
      'done' in body
        ? call('setSubtaskDone', { ...path, done: body.done })
        : call('setSubtaskEstimate', { ...path, hours: body.hours }),
  }),
  adoptEstimateSuggestion: surface('adoptEstimateSuggestion', {
    method: 'POST',
    url: '/tasks/{taskId}/suggestions/{suggestionId}/adopt',
    status: 204,
    path: c.vAdoptEstimateSuggestionPath,
    body: c.vAdoptEstimateSuggestionBody,
    operation: ({ path, body }) =>
      'bound' in body
        ? call('adoptSuggestion', { ...path, bound: body.bound })
        : call('adoptEditedSuggestion', { ...path, hours: body.hours }),
  }),
  undoAdoption: surface('undoAdoption', {
    method: 'POST',
    url: '/tasks/{taskId}/suggestions/{suggestionId}/undo-adoption',
    status: 204,
    path: c.vUndoAdoptionPath,
    body: c.vUndoAdoptionBody,
    operation: ({ path, body }) => call('undoAdoption', { ...path, ...body }),
  }),
  rejectSuggestion: surface('rejectSuggestion', {
    method: 'POST',
    url: '/tasks/{taskId}/suggestions/{suggestionId}/reject',
    status: 204,
    path: c.vRejectSuggestionPath,
    operation: ({ path }) => call('rejectSuggestion', path),
  }),
  undoRejection: surface('undoRejection', {
    method: 'POST',
    url: '/tasks/{taskId}/suggestions/{suggestionId}/undo-rejection',
    status: 204,
    path: c.vUndoRejectionPath,
    operation: ({ path }) => call('undoRejection', path),
  }),

  // ------------------------------------------------------------ Planning
  beginPlanning: surface('beginPlanning', {
    method: 'POST',
    url: '/planning',
    status: 201,
    operation: () => call('beginPlanning', undefined),
  }),
  setPlanningAvailableHours: surface('setPlanningAvailableHours', {
    method: 'PATCH',
    url: '/planning',
    status: 204,
    body: c.vSetPlanningAvailableHoursBody,
    operation: ({ body }) =>
      call('setPlanningAvailableHours', { hours: body.availableHours }),
  }),
  confirmSprint: surface('confirmSprint', {
    method: 'POST',
    url: '/planning/confirm',
    status: 204,
    body: c.vConfirmSprintBody,
    operation: ({ body }) => call('confirmSprint', body),
  }),
  setPlanningGoal: surface('setPlanningGoal', {
    method: 'PUT',
    url: '/planning/goals/{areaId}',
    status: 204,
    path: c.vSetPlanningGoalPath,
    body: c.vSetPlanningGoalBody,
    operation: ({ path, body }) =>
      call('setPlanningGoal', { ...path, ...body }),
  }),
  chooseTasks: surface('chooseTasks', {
    method: 'POST',
    url: '/planning/tasks',
    status: 201,
    body: c.vChooseTasksBody,
    operation: ({ body }) => call('chooseTasks', body),
  }),
  unchoosePlanningTasks: surface('unchoosePlanningTasks', {
    method: 'DELETE',
    url: '/planning/tasks',
    status: 204,
    query: c.vUnchoosePlanningTasksQuery,
    operation: ({ query: { ids, 'task-ids': taskIds } }) => {
      // The contract cannot say "exactly one of the two" for a query.
      if (ids !== undefined && taskIds === undefined)
        return call('unchooseTasks', { sprintTaskIds: ids });
      if (taskIds !== undefined && ids === undefined)
        return call('unchooseTasksByTask', { taskIds });
      throw new RequestError('query: give either ids or task-ids.');
    },
  }),
  setGoalLink: surface('setGoalLink', {
    method: 'PATCH',
    url: '/planning/tasks/{sprintTaskId}',
    status: 204,
    path: c.vSetGoalLinkPath,
    body: c.vSetGoalLinkBody,
    operation: ({ path, body }) => call('setGoalLink', { ...path, ...body }),
  }),
  excludeAllOccurrences: surface('excludeAllOccurrences', {
    method: 'POST',
    url: '/planning/tasks/{sprintTaskId}/exclude-occurrences',
    status: 204,
    path: c.vExcludeAllOccurrencesPath,
    operation: ({ path }) => call('excludeAllOccurrences', path),
  }),
  setOccurrenceIncluded: surface('setOccurrenceIncluded', {
    method: 'PATCH',
    url: '/planning/occurrences/{occurrenceId}',
    status: 204,
    path: c.vSetOccurrenceIncludedPath,
    body: c.vSetOccurrenceIncludedBody,
    operation: ({ path, body }) =>
      call('setOccurrenceIncluded', { ...path, ...body }),
  }),
  includeOccurrences: surface('includeOccurrences', {
    method: 'POST',
    url: '/planning/occurrences/include',
    status: 204,
    body: c.vIncludeOccurrencesBody,
    operation: ({ body }) => call('includeOccurrences', body),
  }),

  // --------------------------------------------------------------- Today
  createDailySelection: surface('createDailySelection', {
    method: 'POST',
    url: '/today/selections',
    status: 201,
    body: c.vCreateDailySelectionBody,
    operation: ({ body }) =>
      'taskId' in body
        ? call('addTaskToToday', body)
        : call('chooseForToday', body),
  }),
  startSelection: onSelection(
    'startSelection',
    '/today/selections/{selectionId}/start',
    c.vStartSelectionPath,
  ),
  pauseSelection: surface('pauseSelection', {
    method: 'POST',
    url: '/today/selections/{selectionId}/pause',
    status: 204,
    path: c.vPauseSelectionPath,
    body: c.vPauseSelectionBody,
    operation: ({ path, body }) => call('pauseSelection', { ...path, ...body }),
  }),
  deferSelection: onSelection(
    'deferSelection',
    '/today/selections/{selectionId}/defer',
    c.vDeferSelectionPath,
  ),
  removeFromToday: onSelection(
    'removeFromToday',
    '/today/selections/{selectionId}/remove',
    c.vRemoveFromTodayPath,
  ),
  completeSelection: onSelection(
    'completeSelection',
    '/today/selections/{selectionId}/complete',
    c.vCompleteSelectionPath,
  ),
  skipSelection: onSelection(
    'skipSelection',
    '/today/selections/{selectionId}/skip',
    c.vSkipSelectionPath,
  ),
  undoCloseSelection: onSelection(
    'undoCloseSelection',
    '/today/selections/{selectionId}/undo-close',
    c.vUndoCloseSelectionPath,
  ),
  undoCompleteSelection: onSelection(
    'undoCompleteSelection',
    '/today/selections/{selectionId}/undo-complete',
    c.vUndoCompleteSelectionPath,
  ),
  undoSkipSelection: onSelection(
    'undoSkipSelection',
    '/today/selections/{selectionId}/undo-skip',
    c.vUndoSkipSelectionPath,
  ),
  recordSelectionActual: surface('recordSelectionActual', {
    method: 'POST',
    url: '/today/selections/{selectionId}/actuals',
    status: 204,
    path: c.vRecordSelectionActualPath,
    body: c.vRecordSelectionActualBody,
    operation: ({ path, body }) =>
      call('recordSelectionActual', { ...path, ...body }),
  }),
  noteInterrupt: surface('noteInterrupt', {
    method: 'POST',
    url: '/today/interrupts',
    status: 201,
    body: c.vNoteInterruptBody,
    operation: ({ body }) => call('noteInterrupt', body),
  }),
  editInterrupt: surface('editInterrupt', {
    method: 'PATCH',
    url: '/today/interrupts/{interruptNoteId}',
    status: 204,
    path: c.vEditInterruptPath,
    body: c.vEditInterruptBody,
    operation: ({ path, body }) => call('editInterrupt', { ...path, ...body }),
  }),
  deleteInterrupt: surface('deleteInterrupt', {
    method: 'DELETE',
    url: '/today/interrupts/{interruptNoteId}',
    status: 204,
    path: c.vDeleteInterruptPath,
    operation: ({ path }) => call('deleteInterrupt', path),
  }),
  restoreInterrupt: surface('restoreInterrupt', {
    method: 'PUT',
    url: '/today/interrupts/{interruptNoteId}',
    status: 204,
    path: c.vRestoreInterruptPath,
    body: c.vRestoreInterruptBody,
    operation: ({ path, body }) =>
      call('restoreInterrupt', {
        note: { id: path.interruptNoteId, ...body },
      }),
  }),

  // ------------------------------------------------- Sprint after confirm
  setRunningAvailableHours: surface('setRunningAvailableHours', {
    method: 'PATCH',
    url: '/running',
    status: 204,
    body: c.vSetRunningAvailableHoursBody,
    operation: ({ body }) =>
      call('setRunningAvailableHours', { hours: body.availableHours }),
  }),
  setRunningGoal: surface('setRunningGoal', {
    method: 'PUT',
    url: '/running/goals/{areaId}',
    status: 204,
    path: c.vSetRunningGoalPath,
    body: c.vSetRunningGoalBody,
    operation: ({ path, body }) => call('setRunningGoal', { ...path, ...body }),
  }),
  addTaskToWeek: surface('addTaskToWeek', {
    method: 'PUT',
    url: '/running/tasks/{taskId}',
    status: 201,
    path: c.vAddTaskToWeekPath,
    operation: ({ path }) => call('addTaskToWeek', path),
  }),
  undoAddTaskToWeek: surface('undoAddTaskToWeek', {
    method: 'DELETE',
    url: '/running/tasks/{taskId}',
    status: 204,
    path: c.vUndoAddTaskToWeekPath,
    operation: ({ path }) => call('undoAddTaskToWeek', path),
  }),
  undoPastDay: surface('undoPastDay', {
    method: 'POST',
    url: '/running/selections/{selectionId}/undo',
    status: 204,
    path: c.vUndoPastDayPath,
    operation: ({ path }) => call('undoPastDay', path),
  }),

  // --------------------------------------------------------------- Retro
  updateRetro: surface('updateRetro', {
    method: 'PATCH',
    url: '/retro',
    status: 204,
    body: c.vUpdateRetroBody,
    operation: ({ body }) => {
      if ('reflection' in body)
        return call('setReflection', { text: body.reflection });
      if ('improvement' in body)
        return call('setImprovement', { text: body.improvement });
      return call('decideCriterion', { decision: body.criterionDecision });
    },
  }),
  beginRetro: surface('beginRetro', {
    method: 'POST',
    url: '/retro/begin',
    status: 204,
    operation: () => call('beginRetro', undefined),
  }),
  completeRetro: surface('completeRetro', {
    method: 'POST',
    url: '/retro/complete',
    status: 204,
    operation: () => call('completeRetro', undefined),
  }),
  assessGoal: surface('assessGoal', {
    method: 'PATCH',
    url: '/retro/goals/{areaId}',
    status: 204,
    path: c.vAssessGoalPath,
    body: c.vAssessGoalBody,
    operation: ({ path, body }) => call('assessGoal', { ...path, ...body }),
  }),
  pinFact: surface('pinFact', {
    method: 'PUT',
    url: '/retro/pins/{pin}',
    status: 204,
    path: c.vPinFactPath,
    operation: ({ path }) => call('pinFact', { pin: retroPin(path.pin) }),
  }),
  unpinFact: surface('unpinFact', {
    method: 'DELETE',
    url: '/retro/pins/{pin}',
    status: 204,
    path: c.vUnpinFactPath,
    operation: ({ path }) => call('unpinFact', { pin: retroPin(path.pin) }),
  }),
  draftCriterion: surface('draftCriterion', {
    method: 'POST',
    url: '/retro/draft-criterion',
    status: 201,
    body: c.vDraftCriterionBody,
    operation: ({ body }) => call('draftCriterion', body),
  }),
  setDraftPolicy: surface('setDraftPolicy', {
    method: 'PATCH',
    url: '/retro/draft-criterion',
    status: 204,
    body: c.vSetDraftPolicyBody,
    operation: ({ body }) => call('setDraftPolicy', body),
  }),
  dropCriterionDraft: surface('dropCriterionDraft', {
    method: 'DELETE',
    url: '/retro/draft-criterion',
    status: 204,
    operation: () => call('dropCriterionDraft', undefined),
  }),
  recordReviewActual: surface('recordReviewActual', {
    method: 'POST',
    url: '/retro/actuals',
    status: 204,
    body: c.vRecordReviewActualBody,
    operation: ({ body }) => call('recordReviewActual', body),
  }),
};

/** A request the contract's schemas let through but no operation takes (400). */
export class RequestError extends Error {}

type SelectionSurface =
  | 'startSelection'
  | 'deferSelection'
  | 'removeFromToday'
  | 'completeSelection'
  | 'skipSelection'
  | 'undoCloseSelection'
  | 'undoCompleteSelection'
  | 'undoSkipSelection';

/**
 * `POST /today/selections/{selectionId}/<verb>`: a change of today's
 * selection, the operation of the same name.
 */
function onSelection<S extends SelectionSurface>(
  name: S,
  url: Datas[S]['url'],
  path: v.GenericSchema,
): Surface<S> {
  return {
    method: 'POST',
    url,
    status: 204 as Surface<S>['status'],
    path,
    operation: ({ path: { selectionId } }) =>
      call(name, { selectionId } as Plain<OperationInput<S>>),
  };
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
  if (kind === undefined) throw new RequestError(`path.pin: ${pin}`);
  return { kind, id: pin };
}

// ------------------------------------------------------- the other way

/** The surface each operation goes to (`requestOf`). */
export type OperationSurfaces = {
  createArea: 'createArea';
  renameArea: 'updateArea';
  archiveArea: 'updateArea';
  restoreArea: 'updateArea';
  createTask: 'quickAddTask';
  saveTask: 'updateTask';
  adoptSuggestion: 'adoptEstimateSuggestion';
  undoAdoption: 'undoAdoption';
  adoptEditedSuggestion: 'adoptEstimateSuggestion';
  rejectSuggestion: 'rejectSuggestion';
  undoRejection: 'undoRejection';
  addSubtask: 'addSubtask';
  setSubtaskDone: 'updateSubtask';
  setSubtaskEstimate: 'updateSubtask';
  archiveTask: 'updateTask';
  restoreTask: 'updateTask';
  completeTask: 'completeTask';
  undoCompleteTask: 'undoCompleteTask';
  addTaskToToday: 'createDailySelection';
  addTaskToWeek: 'addTaskToWeek';
  undoAddTaskToWeek: 'undoAddTaskToWeek';
  setRecurrence: 'setRecurrence';
  endRecurrence: 'endRecurrence';
  chooseTasks: 'chooseTasks';
  unchooseTasks: 'unchoosePlanningTasks';
  unchooseTasksByTask: 'unchoosePlanningTasks';
  setOccurrenceIncluded: 'setOccurrenceIncluded';
  includeOccurrences: 'includeOccurrences';
  excludeAllOccurrences: 'excludeAllOccurrences';
  createAndChooseTask: 'quickAddTask';
  setPlanningGoal: 'setPlanningGoal';
  setGoalLink: 'setGoalLink';
  setPlanningAvailableHours: 'setPlanningAvailableHours';
  confirmSprint: 'confirmSprint';
  chooseForToday: 'createDailySelection';
  startSelection: 'startSelection';
  deferSelection: 'deferSelection';
  removeFromToday: 'removeFromToday';
  undoCloseSelection: 'undoCloseSelection';
  pauseSelection: 'pauseSelection';
  completeSelection: 'completeSelection';
  undoCompleteSelection: 'undoCompleteSelection';
  skipSelection: 'skipSelection';
  undoSkipSelection: 'undoSkipSelection';
  recordSelectionActual: 'recordSelectionActual';
  noteInterrupt: 'noteInterrupt';
  editInterrupt: 'editInterrupt';
  deleteInterrupt: 'deleteInterrupt';
  restoreInterrupt: 'restoreInterrupt';
  createTaskForToday: 'quickAddTask';
  beginRetro: 'beginRetro';
  setRunningGoal: 'setRunningGoal';
  setRunningAvailableHours: 'setRunningAvailableHours';
  undoPastDay: 'undoPastDay';
  assessGoal: 'assessGoal';
  pinFact: 'pinFact';
  unpinFact: 'unpinFact';
  setReflection: 'updateRetro';
  setImprovement: 'updateRetro';
  draftCriterion: 'draftCriterion';
  setDraftPolicy: 'setDraftPolicy';
  dropCriterionDraft: 'dropCriterionDraft';
  decideCriterion: 'updateRetro';
  recordReviewActual: 'recordReviewActual';
  completeRetro: 'completeRetro';
  beginPlanning: 'beginPlanning';
};

/** The request of an operation: the surface and its parts. */
export type Request<S extends SurfaceId = SurfaceId> = {
  readonly operationId: S;
} & RequestParts<S>;

function to<S extends SurfaceId>(
  operationId: S,
  parts: RequestParts<S>,
): Request<S> {
  return { operationId, ...parts };
}

/** The path value naming a pinned fact (`retroPin` reads it back). */
function pinPath(pin: PlainInput<'pinFact'>['pin']) {
  if (pin.kind === 'availableHours') return { pin: 'available-hours' as const };
  if (pin.id === undefined) throw new Error(`A ${pin.kind} pin names its ID.`);
  return { pin: pin.id };
}

/** Each operation's request: the surface it goes to and its parts. */
const requests: {
  readonly [N in OperationName]: (
    input: PlainInput<N>,
  ) => Request<OperationSurfaces[N]>;
} = {
  // ---------------------------------------------------------------- Area
  createArea: (body) => to('createArea', { body }),
  renameArea: ({ areaId, name }) =>
    to('updateArea', { path: { areaId }, body: { name } }),
  archiveArea: ({ areaId }) =>
    to('updateArea', { path: { areaId }, body: { archived: true } }),
  restoreArea: ({ areaId }) =>
    to('updateArea', { path: { areaId }, body: { archived: false } }),

  // ---------------------------------------------------------------- Task
  createTask: (body) => to('quickAddTask', { body }),
  saveTask: ({ taskId, update, estimate }) =>
    to('updateTask', {
      path: { taskId },
      body: { ...update, ...(estimate === undefined ? {} : { estimate }) },
    }),
  adoptSuggestion: ({ taskId, suggestionId, bound }) =>
    to('adoptEstimateSuggestion', {
      path: { taskId, suggestionId },
      body: { bound },
    }),
  undoAdoption: ({ taskId, suggestionId, previous }) =>
    to('undoAdoption', { path: { taskId, suggestionId }, body: { previous } }),
  adoptEditedSuggestion: ({ taskId, suggestionId, hours }) =>
    to('adoptEstimateSuggestion', {
      path: { taskId, suggestionId },
      body: { hours },
    }),
  rejectSuggestion: (path) => to('rejectSuggestion', { path }),
  undoRejection: (path) => to('undoRejection', { path }),
  addSubtask: ({ taskId, ...body }) =>
    to('addSubtask', { path: { taskId }, body }),
  setSubtaskDone: ({ taskId, subtaskId, done }) =>
    to('updateSubtask', { path: { taskId, subtaskId }, body: { done } }),
  setSubtaskEstimate: ({ taskId, subtaskId, hours }) =>
    to('updateSubtask', { path: { taskId, subtaskId }, body: { hours } }),
  archiveTask: ({ taskId }) =>
    to('updateTask', { path: { taskId }, body: { archived: true } }),
  restoreTask: ({ taskId }) =>
    to('updateTask', { path: { taskId }, body: { archived: false } }),
  completeTask: (path) => to('completeTask', { path }),
  undoCompleteTask: (path) => to('undoCompleteTask', { path }),
  addTaskToToday: (body) => to('createDailySelection', { body }),
  addTaskToWeek: (path) => to('addTaskToWeek', { path }),
  undoAddTaskToWeek: (path) => to('undoAddTaskToWeek', { path }),
  setRecurrence: ({ taskId, pattern }) =>
    to('setRecurrence', { path: { taskId }, body: { pattern } }),
  endRecurrence: (path) => to('endRecurrence', { path }),

  // ------------------------------------------------------------ Planning
  chooseTasks: ({ taskIds }) =>
    to('chooseTasks', { body: { taskIds: [...taskIds] } }),
  unchooseTasks: ({ sprintTaskIds }) =>
    to('unchoosePlanningTasks', { query: { ids: [...sprintTaskIds] } }),
  unchooseTasksByTask: ({ taskIds }) =>
    to('unchoosePlanningTasks', { query: { 'task-ids': [...taskIds] } }),
  setOccurrenceIncluded: ({ occurrenceId, included }) =>
    to('setOccurrenceIncluded', {
      path: { occurrenceId },
      body: { included },
    }),
  includeOccurrences: ({ occurrenceIds }) =>
    to('includeOccurrences', {
      body: { occurrenceIds: [...occurrenceIds] },
    }),
  excludeAllOccurrences: (path) => to('excludeAllOccurrences', { path }),
  createAndChooseTask: (task) =>
    to('quickAddTask', { body: { ...task, addTo: 'planning' } }),
  setPlanningGoal: ({ areaId, text }) =>
    to('setPlanningGoal', { path: { areaId }, body: { text } }),
  setGoalLink: ({ sprintTaskId, goalLink }) =>
    to('setGoalLink', { path: { sprintTaskId }, body: { goalLink } }),
  setPlanningAvailableHours: ({ hours }) =>
    to('setPlanningAvailableHours', { body: { availableHours: hours } }),
  confirmSprint: (body) => to('confirmSprint', { body }),

  // --------------------------------------------------------------- Today
  chooseForToday: (body) => to('createDailySelection', { body }),
  startSelection: (path) => to('startSelection', { path }),
  deferSelection: (path) => to('deferSelection', { path }),
  removeFromToday: (path) => to('removeFromToday', { path }),
  undoCloseSelection: (path) => to('undoCloseSelection', { path }),
  pauseSelection: ({ selectionId, ...body }) =>
    to('pauseSelection', { path: { selectionId }, body }),
  completeSelection: (path) => to('completeSelection', { path }),
  undoCompleteSelection: (path) => to('undoCompleteSelection', { path }),
  skipSelection: (path) => to('skipSelection', { path }),
  undoSkipSelection: (path) => to('undoSkipSelection', { path }),
  recordSelectionActual: ({ selectionId, hours }) =>
    to('recordSelectionActual', { path: { selectionId }, body: { hours } }),
  noteInterrupt: (body) => to('noteInterrupt', { body }),
  editInterrupt: ({ interruptNoteId, ...body }) =>
    to('editInterrupt', { path: { interruptNoteId }, body }),
  deleteInterrupt: (path) => to('deleteInterrupt', { path }),
  restoreInterrupt: ({ note: { id, ...body } }) =>
    to('restoreInterrupt', { path: { interruptNoteId: id }, body }),
  createTaskForToday: (task) =>
    to('quickAddTask', { body: { ...task, addTo: 'today' } }),
  beginRetro: () => to('beginRetro', {}),

  // ------------------------------------------------- Sprint after confirm
  setRunningGoal: ({ areaId, text }) =>
    to('setRunningGoal', { path: { areaId }, body: { text } }),
  setRunningAvailableHours: ({ hours }) =>
    to('setRunningAvailableHours', { body: { availableHours: hours } }),
  undoPastDay: (path) => to('undoPastDay', { path }),

  // --------------------------------------------------------------- Retro
  assessGoal: ({ areaId, assessment }) =>
    to('assessGoal', { path: { areaId }, body: { assessment } }),
  pinFact: ({ pin }) => to('pinFact', { path: pinPath(pin) }),
  unpinFact: ({ pin }) => to('unpinFact', { path: pinPath(pin) }),
  setReflection: ({ text }) =>
    to('updateRetro', { body: { reflection: text } }),
  setImprovement: ({ text }) =>
    to('updateRetro', { body: { improvement: text } }),
  draftCriterion: (body) => to('draftCriterion', { body }),
  setDraftPolicy: (body) => to('setDraftPolicy', { body }),
  dropCriterionDraft: () => to('dropCriterionDraft', {}),
  decideCriterion: ({ decision }) =>
    to('updateRetro', { body: { criterionDecision: decision } }),
  recordReviewActual: (body) => to('recordReviewActual', { body }),
  completeRetro: () => to('completeRetro', {}),
  beginPlanning: () => to('beginPlanning', {}),
};

/** The request of an operation and its input (the web app sends it). */
export function requestOf<N extends OperationName>(
  name: N,
  input: PlainInput<N>,
): Request<OperationSurfaces[N]> {
  return (
    requests[name] as (input: PlainInput<N>) => Request<OperationSurfaces[N]>
  )(input);
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
