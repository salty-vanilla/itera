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
import { issueAt, type RequestPart, type ValidationIssue } from './problems';

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
  renameArea: c.RenameAreaData;
  archiveArea: c.ArchiveAreaData;
  restoreArea: c.RestoreAreaData;
  createTask: c.CreateTaskData;
  saveTask: c.SaveTaskData;
  archiveTask: c.ArchiveTaskData;
  restoreTask: c.RestoreTaskData;
  completeTask: c.CompleteTaskData;
  undoCompleteTask: c.UndoCompleteTaskData;
  endRecurrence: c.EndRecurrenceData;
  setRecurrence: c.SetRecurrenceData;
  addSubtask: c.AddSubtaskData;
  updateSubtask: c.UpdateSubtaskData;
  adoptEstimateSuggestion: c.AdoptEstimateSuggestionData;
  undoAdoption: c.UndoAdoptionData;
  rejectSuggestion: c.RejectSuggestionData;
  undoRejection: c.UndoRejectionData;
  beginPlanning: c.BeginPlanningData;
  setAvailableHours: c.SetAvailableHoursData;
  confirmSprint: c.ConfirmSprintData;
  updateGoal: c.UpdateGoalData;
  removeSprintTasks: c.RemoveSprintTasksData;
  addToSprint: c.AddToSprintData;
  removeSprintTask: c.RemoveSprintTaskData;
  setGoalLink: c.SetGoalLinkData;
  excludeAllOccurrences: c.ExcludeAllOccurrencesData;
  includeOccurrences: c.IncludeOccurrencesData;
  excludeOccurrence: c.ExcludeOccurrenceData;
  includeOccurrence: c.IncludeOccurrenceData;
  chooseForDay: c.ChooseForDayData;
  startSelection: c.StartSelectionData;
  pauseSelection: c.PauseSelectionData;
  deferSelection: c.DeferSelectionData;
  undoDeferSelection: c.UndoDeferSelectionData;
  removeFromToday: c.RemoveFromTodayData;
  undoRemoveFromToday: c.UndoRemoveFromTodayData;
  completeSelection: c.CompleteSelectionData;
  undoCompleteSelection: c.UndoCompleteSelectionData;
  skipSelection: c.SkipSelectionData;
  undoSkipSelection: c.UndoSkipSelectionData;
  recordActualTime: c.RecordActualTimeData;
  noteInterrupt: c.NoteInterruptData;
  deleteInterrupt: c.DeleteInterruptData;
  editInterrupt: c.EditInterruptData;
  restoreInterrupt: c.RestoreInterruptData;
  updateRetro: c.UpdateRetroData;
  beginRetro: c.BeginRetroData;
  completeRetro: c.CompleteRetroData;
  unpinFact: c.UnpinFactData;
  pinFact: c.PinFactData;
  decideCriterion: c.DecideCriterionData;
  draftCriterion: c.DraftCriterionData;
  dropCriterionDraft: c.DropCriterionDraftData;
  setDraftPolicy: c.SetDraftPolicyData;
};

/** Each surface's responses by status, as generated (`<OperationId>Responses`). */
type Responses = {
  createArea: c.CreateAreaResponses;
  renameArea: c.RenameAreaResponses;
  archiveArea: c.ArchiveAreaResponses;
  restoreArea: c.RestoreAreaResponses;
  createTask: c.CreateTaskResponses;
  saveTask: c.SaveTaskResponses;
  archiveTask: c.ArchiveTaskResponses;
  restoreTask: c.RestoreTaskResponses;
  completeTask: c.CompleteTaskResponses;
  undoCompleteTask: c.UndoCompleteTaskResponses;
  endRecurrence: c.EndRecurrenceResponses;
  setRecurrence: c.SetRecurrenceResponses;
  addSubtask: c.AddSubtaskResponses;
  updateSubtask: c.UpdateSubtaskResponses;
  adoptEstimateSuggestion: c.AdoptEstimateSuggestionResponses;
  undoAdoption: c.UndoAdoptionResponses;
  rejectSuggestion: c.RejectSuggestionResponses;
  undoRejection: c.UndoRejectionResponses;
  beginPlanning: c.BeginPlanningResponses;
  setAvailableHours: c.SetAvailableHoursResponses;
  confirmSprint: c.ConfirmSprintResponses;
  updateGoal: c.UpdateGoalResponses;
  removeSprintTasks: c.RemoveSprintTasksResponses;
  addToSprint: c.AddToSprintResponses;
  removeSprintTask: c.RemoveSprintTaskResponses;
  setGoalLink: c.SetGoalLinkResponses;
  excludeAllOccurrences: c.ExcludeAllOccurrencesResponses;
  includeOccurrences: c.IncludeOccurrencesResponses;
  excludeOccurrence: c.ExcludeOccurrenceResponses;
  includeOccurrence: c.IncludeOccurrenceResponses;
  chooseForDay: c.ChooseForDayResponses;
  startSelection: c.StartSelectionResponses;
  pauseSelection: c.PauseSelectionResponses;
  deferSelection: c.DeferSelectionResponses;
  undoDeferSelection: c.UndoDeferSelectionResponses;
  removeFromToday: c.RemoveFromTodayResponses;
  undoRemoveFromToday: c.UndoRemoveFromTodayResponses;
  completeSelection: c.CompleteSelectionResponses;
  undoCompleteSelection: c.UndoCompleteSelectionResponses;
  skipSelection: c.SkipSelectionResponses;
  undoSkipSelection: c.UndoSkipSelectionResponses;
  recordActualTime: c.RecordActualTimeResponses;
  noteInterrupt: c.NoteInterruptResponses;
  deleteInterrupt: c.DeleteInterruptResponses;
  editInterrupt: c.EditInterruptResponses;
  restoreInterrupt: c.RestoreInterruptResponses;
  updateRetro: c.UpdateRetroResponses;
  beginRetro: c.BeginRetroResponses;
  completeRetro: c.CompleteRetroResponses;
  unpinFact: c.UnpinFactResponses;
  pinFact: c.PinFactResponses;
  decideCriterion: c.DecideCriterionResponses;
  draftCriterion: c.DraftCriterionResponses;
  dropCriterionDraft: c.DropCriterionDraftResponses;
  setDraftPolicy: c.SetDraftPolicyResponses;
};

export type { OperationName };

/**
 * An operation's input as a client gives it, and its output as the
 * response carries it: IDs and dates are the contract's strings.
 */
export type PlainInput<N extends OperationName> = Plain<OperationInput<N>>;
export type PlainOutput<N extends OperationName> = Plain<OperationOutput<N>>;

/**
 * The attributes `saveTask` changes (`update`), as `PATCH /tasks/{taskId}`
 * carries them at the top of its body with the Estimate.
 */
export type TaskAttributeUpdate = PlainInput<'saveTask'>['update'];

/** The operationId of a surface: a write of the contract. */
export type SurfaceId = keyof Datas;

/**
 * The request's parts of a surface, as the generated client takes them.
 * The Idempotency-Key is not a part of the operation: the sender adds it
 * for each write (`idempotencyKeyHeaders`).
 */
export type RequestParts<S extends SurfaceId> = Omit<
  Datas[S],
  'url' | 'headers'
>;

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
  renameArea: surface('renameArea', {
    method: 'PATCH',
    url: '/areas/{areaId}',
    status: 204,
    path: c.vRenameAreaPath,
    body: c.vRenameAreaBody,
    operation: ({ path, body }) => call('renameArea', { ...path, ...body }),
  }),
  archiveArea: surface('archiveArea', {
    method: 'POST',
    url: '/areas/{areaId}/archive',
    status: 204,
    path: c.vArchiveAreaPath,
    operation: ({ path }) => call('archiveArea', path),
  }),
  restoreArea: surface('restoreArea', {
    method: 'POST',
    url: '/areas/{areaId}/restore',
    status: 204,
    path: c.vRestoreAreaPath,
    operation: ({ path }) => call('restoreArea', path),
  }),

  // ---------------------------------------------------------------- Task
  createTask: surface('createTask', {
    method: 'POST',
    url: '/tasks',
    status: 201,
    body: c.vCreateTaskBody,
    operation: ({ body }) => call('createTask', body),
  }),
  saveTask: surface('saveTask', {
    method: 'PATCH',
    url: '/tasks/{taskId}',
    status: 204,
    path: c.vSaveTaskPath,
    body: c.vSaveTaskBody,
    operation: ({ path: { taskId }, body: { estimate, ...update } }) =>
      call('saveTask', {
        taskId,
        update,
        ...(estimate === undefined ? {} : { estimate }),
      }),
  }),
  archiveTask: onTask(
    'archiveTask',
    '/tasks/{taskId}/archive',
    c.vArchiveTaskPath,
  ),
  restoreTask: onTask(
    'restoreTask',
    '/tasks/{taskId}/restore',
    c.vRestoreTaskPath,
  ),
  completeTask: onTask(
    'completeTask',
    '/tasks/{taskId}/complete',
    c.vCompleteTaskPath,
  ),
  undoCompleteTask: onTask(
    'undoCompleteTask',
    '/tasks/{taskId}/undo-complete',
    c.vUndoCompleteTaskPath,
  ),
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
    url: '/tasks/{taskId}/estimate-suggestions/{suggestionId}/adopt',
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
    url: '/tasks/{taskId}/estimate-suggestions/{suggestionId}/undo-adopt',
    status: 204,
    path: c.vUndoAdoptionPath,
    body: c.vUndoAdoptionBody,
    operation: ({ path, body }) => call('undoAdoption', { ...path, ...body }),
  }),
  rejectSuggestion: surface('rejectSuggestion', {
    method: 'POST',
    url: '/tasks/{taskId}/estimate-suggestions/{suggestionId}/reject',
    status: 204,
    path: c.vRejectSuggestionPath,
    operation: ({ path }) => call('rejectSuggestion', path),
  }),
  undoRejection: surface('undoRejection', {
    method: 'POST',
    url: '/tasks/{taskId}/estimate-suggestions/{suggestionId}/undo-reject',
    status: 204,
    path: c.vUndoRejectionPath,
    operation: ({ path }) => call('undoRejection', path),
  }),

  // -------------------------------------------------------------- Sprint
  beginPlanning: surface('beginPlanning', {
    method: 'POST',
    url: '/sprints',
    status: 201,
    operation: () => call('beginPlanning', undefined),
  }),
  setAvailableHours: surface('setAvailableHours', {
    method: 'PATCH',
    url: '/sprints/{sprintId}',
    status: 204,
    path: c.vSetAvailableHoursPath,
    body: c.vSetAvailableHoursBody,
    operation: ({ path, body }) =>
      call('setAvailableHours', { ...path, hours: body.availableHours }),
  }),
  confirmSprint: surface('confirmSprint', {
    method: 'POST',
    url: '/sprints/{sprintId}/confirm',
    status: 204,
    path: c.vConfirmSprintPath,
    body: c.vConfirmSprintBody,
    operation: ({ path, body }) => call('confirmSprint', { ...path, ...body }),
  }),
  updateGoal: surface('updateGoal', {
    method: 'PATCH',
    url: '/sprints/{sprintId}/goals/{areaId}',
    status: 204,
    path: c.vUpdateGoalPath,
    body: c.vUpdateGoalBody,
    operation: ({ path, body }) =>
      'text' in body
        ? call('setGoal', { ...path, text: body.text })
        : call('assessGoal', { ...path, assessment: body.assessment }),
  }),
  addToSprint: surface('addToSprint', {
    method: 'POST',
    url: '/sprints/{sprintId}/sprint-tasks',
    status: 201,
    path: c.vAddToSprintPath,
    body: c.vAddToSprintBody,
    operation: ({ path, body }) =>
      'taskIds' in body
        ? call('addSprintTasks', { ...path, taskIds: body.taskIds })
        : call('createAndChooseTask', { ...path, ...body }),
  }),
  removeSprintTasks: surface('removeSprintTasks', {
    method: 'DELETE',
    url: '/sprints/{sprintId}/sprint-tasks',
    status: 204,
    path: c.vRemoveSprintTasksPath,
    query: c.vRemoveSprintTasksQuery,
    operation: ({ path, query }) =>
      call('removeSprintTasks', { ...path, sprintTaskIds: query.ids }),
  }),
  removeSprintTask: surface('removeSprintTask', {
    method: 'DELETE',
    url: '/sprints/{sprintId}/sprint-tasks/{sprintTaskId}',
    status: 204,
    path: c.vRemoveSprintTaskPath,
    operation: ({ path: { sprintId, sprintTaskId } }) =>
      call('removeSprintTasks', { sprintId, sprintTaskIds: [sprintTaskId] }),
  }),
  setGoalLink: surface('setGoalLink', {
    method: 'PATCH',
    url: '/sprints/{sprintId}/sprint-tasks/{sprintTaskId}',
    status: 204,
    path: c.vSetGoalLinkPath,
    body: c.vSetGoalLinkBody,
    operation: ({ path, body }) => call('setGoalLink', { ...path, ...body }),
  }),
  excludeAllOccurrences: surface('excludeAllOccurrences', {
    method: 'POST',
    url: '/sprints/{sprintId}/sprint-tasks/{sprintTaskId}/exclude-occurrences',
    status: 204,
    path: c.vExcludeAllOccurrencesPath,
    operation: ({ path }) => call('excludeAllOccurrences', path),
  }),
  includeOccurrences: surface('includeOccurrences', {
    method: 'POST',
    url: '/sprints/{sprintId}/included-occurrences',
    status: 204,
    path: c.vIncludeOccurrencesPath,
    body: c.vIncludeOccurrencesBody,
    operation: ({ path, body }) =>
      call('includeOccurrences', { ...path, ...body }),
  }),
  includeOccurrence: surface('includeOccurrence', {
    method: 'PUT',
    url: '/sprints/{sprintId}/included-occurrences/{occurrenceId}',
    status: 204,
    path: c.vIncludeOccurrencePath,
    operation: ({ path }) =>
      call('setOccurrenceIncluded', { ...path, included: true }),
  }),
  excludeOccurrence: surface('excludeOccurrence', {
    method: 'DELETE',
    url: '/sprints/{sprintId}/included-occurrences/{occurrenceId}',
    status: 204,
    path: c.vExcludeOccurrencePath,
    operation: ({ path }) =>
      call('setOccurrenceIncluded', { ...path, included: false }),
  }),

  // --------------------------------------------------------------- Today
  chooseForDay: surface('chooseForDay', {
    method: 'POST',
    url: '/sprints/{sprintId}/daily-selections',
    status: 201,
    path: c.vChooseForDayPath,
    body: c.vChooseForDayBody,
    operation: ({ path, body }) => {
      if ('sprintTaskId' in body)
        return call('chooseForToday', { ...path, ...body });
      if ('taskId' in body) return call('addTaskToToday', { ...path, ...body });
      return call('createTaskForToday', { ...path, ...body });
    },
  }),
  startSelection: onSelection(
    'startSelection',
    '/sprints/{sprintId}/daily-selections/{selectionId}/start',
    c.vStartSelectionPath,
  ),
  pauseSelection: surface('pauseSelection', {
    method: 'POST',
    url: '/sprints/{sprintId}/daily-selections/{selectionId}/pause',
    status: 204,
    path: c.vPauseSelectionPath,
    body: c.vPauseSelectionBody,
    operation: ({ path, body }) => call('pauseSelection', { ...path, ...body }),
  }),
  deferSelection: onSelection(
    'deferSelection',
    '/sprints/{sprintId}/daily-selections/{selectionId}/defer',
    c.vDeferSelectionPath,
  ),
  undoDeferSelection: onSelection(
    'undoDeferSelection',
    '/sprints/{sprintId}/daily-selections/{selectionId}/undo-defer',
    c.vUndoDeferSelectionPath,
  ),
  removeFromToday: onSelection(
    'removeFromToday',
    '/sprints/{sprintId}/daily-selections/{selectionId}/remove',
    c.vRemoveFromTodayPath,
  ),
  undoRemoveFromToday: onSelection(
    'undoRemoveFromToday',
    '/sprints/{sprintId}/daily-selections/{selectionId}/undo-remove',
    c.vUndoRemoveFromTodayPath,
  ),
  completeSelection: onSelection(
    'completeSelection',
    '/sprints/{sprintId}/daily-selections/{selectionId}/complete',
    c.vCompleteSelectionPath,
  ),
  undoCompleteSelection: onSelection(
    'undoCompleteSelection',
    '/sprints/{sprintId}/daily-selections/{selectionId}/undo-complete',
    c.vUndoCompleteSelectionPath,
  ),
  skipSelection: onSelection(
    'skipSelection',
    '/sprints/{sprintId}/daily-selections/{selectionId}/skip',
    c.vSkipSelectionPath,
  ),
  undoSkipSelection: onSelection(
    'undoSkipSelection',
    '/sprints/{sprintId}/daily-selections/{selectionId}/undo-skip',
    c.vUndoSkipSelectionPath,
  ),
  recordActualTime: surface('recordActualTime', {
    method: 'POST',
    url: '/sprints/{sprintId}/actual-times',
    status: 204,
    path: c.vRecordActualTimePath,
    body: c.vRecordActualTimeBody,
    operation: ({ path, body }) =>
      call('recordActualTime', { ...path, ...body }),
  }),
  noteInterrupt: surface('noteInterrupt', {
    method: 'POST',
    url: '/sprints/{sprintId}/interrupts',
    status: 201,
    path: c.vNoteInterruptPath,
    body: c.vNoteInterruptBody,
    operation: ({ path, body }) => call('noteInterrupt', { ...path, ...body }),
  }),
  editInterrupt: surface('editInterrupt', {
    method: 'PATCH',
    url: '/sprints/{sprintId}/interrupts/{interruptNoteId}',
    status: 204,
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
    method: 'DELETE',
    url: '/sprints/{sprintId}/interrupts/{interruptNoteId}',
    status: 204,
    path: c.vDeleteInterruptPath,
    operation: ({ path }) => call('deleteInterrupt', path),
  }),
  restoreInterrupt: surface('restoreInterrupt', {
    method: 'PUT',
    url: '/sprints/{sprintId}/interrupts/{interruptNoteId}',
    status: 204,
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
    method: 'POST',
    url: '/sprints/{sprintId}/retro',
    status: 201,
    path: c.vBeginRetroPath,
    operation: ({ path }) => call('beginRetro', path),
  }),
  updateRetro: surface('updateRetro', {
    method: 'PATCH',
    url: '/sprints/{sprintId}/retro',
    status: 204,
    path: c.vUpdateRetroPath,
    body: c.vUpdateRetroBody,
    operation: ({ path, body }) =>
      'reflection' in body
        ? call('setReflection', { ...path, text: body.reflection })
        : call('setImprovement', { ...path, text: body.improvement }),
  }),
  completeRetro: surface('completeRetro', {
    method: 'POST',
    url: '/sprints/{sprintId}/retro/complete',
    status: 204,
    path: c.vCompleteRetroPath,
    operation: ({ path }) => call('completeRetro', path),
  }),
  pinFact: surface('pinFact', {
    method: 'PUT',
    url: '/sprints/{sprintId}/retro/pins/{pin}',
    status: 204,
    path: c.vPinFactPath,
    operation: ({ path: { sprintId, pin } }) =>
      call('pinFact', { sprintId, pin: retroPin(pin) }),
  }),
  unpinFact: surface('unpinFact', {
    method: 'DELETE',
    url: '/sprints/{sprintId}/retro/pins/{pin}',
    status: 204,
    path: c.vUnpinFactPath,
    operation: ({ path: { sprintId, pin } }) =>
      call('unpinFact', { sprintId, pin: retroPin(pin) }),
  }),
  decideCriterion: surface('decideCriterion', {
    method: 'PATCH',
    url: '/sprints/{sprintId}/criterion-use',
    status: 204,
    path: c.vDecideCriterionPath,
    body: c.vDecideCriterionBody,
    operation: ({ path, body }) =>
      call('decideCriterion', { ...path, decision: body.retroDecision }),
  }),

  // -------------------------------------------------- Planning criteria
  draftCriterion: surface('draftCriterion', {
    method: 'POST',
    url: '/planning-criteria',
    status: 201,
    body: c.vDraftCriterionBody,
    operation: ({ body: { sourceSprintId, policy } }) =>
      call('draftCriterion', { sprintId: sourceSprintId, policy }),
  }),
  setDraftPolicy: surface('setDraftPolicy', {
    method: 'PATCH',
    url: '/planning-criteria/{criterionId}',
    status: 204,
    path: c.vSetDraftPolicyPath,
    body: c.vSetDraftPolicyBody,
    operation: ({ path, body }) => call('setDraftPolicy', { ...path, ...body }),
  }),
  dropCriterionDraft: surface('dropCriterionDraft', {
    method: 'DELETE',
    url: '/planning-criteria/{criterionId}',
    status: 204,
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

/** The settings as the request carries them. */
export type SettingsBody = c.SetSettingsData['body'];

/**
 * A request the contract's schemas let through but no operation takes, or
 * an input no request can carry (400 `validation-failed`). `issue` says
 * where.
 */
export class RequestError extends Error {
  constructor(readonly issue: ValidationIssue) {
    super(issue.detail);
  }
}

/**
 * A list for a query, which cannot carry an empty one (the contract's
 * `minItems: 1`). Taking out no SprintTask is sending nothing.
 */
function nonEmpty<T>(list: readonly T[], name: string): T[] {
  if (list.length === 0)
    throw new RequestError(
      issueAt('query', [name], 'a query cannot carry an empty list.'),
    );
  return [...list];
}

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
  url: Datas[S]['url'],
  path: v.GenericSchema,
): Surface<S> {
  return {
    method: 'POST',
    url,
    status: 204 as Surface<S>['status'],
    path,
    operation: ({ path: { sprintId, selectionId } }) =>
      call(name, { sprintId, selectionId } as Plain<OperationInput<S>>),
  };
}

type TaskVerbSurface =
  'archiveTask' | 'restoreTask' | 'completeTask' | 'undoCompleteTask';

/** `POST /tasks/{taskId}/<verb>`: a change of a Task's state. */
function onTask<S extends TaskVerbSurface>(
  name: S,
  url: Datas[S]['url'],
  path: v.GenericSchema,
): Surface<S> {
  return {
    method: 'POST',
    url,
    status: 204 as Surface<S>['status'],
    path,
    operation: ({ path: { taskId } }) =>
      call(name, { taskId } as Plain<OperationInput<S>>),
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
  if (kind === undefined)
    throw new RequestError(issueAt('path', ['pin'], `not a fact: ${pin}`));
  return { kind, id: pin };
}

// ------------------------------------------------------- the other way

/** The surface each operation goes to (`requestOf`). */
export type OperationSurfaces = {
  createArea: 'createArea';
  renameArea: 'renameArea';
  archiveArea: 'archiveArea';
  restoreArea: 'restoreArea';
  createTask: 'createTask';
  saveTask: 'saveTask';
  adoptSuggestion: 'adoptEstimateSuggestion';
  undoAdoption: 'undoAdoption';
  adoptEditedSuggestion: 'adoptEstimateSuggestion';
  rejectSuggestion: 'rejectSuggestion';
  undoRejection: 'undoRejection';
  addSubtask: 'addSubtask';
  setSubtaskDone: 'updateSubtask';
  setSubtaskEstimate: 'updateSubtask';
  archiveTask: 'archiveTask';
  restoreTask: 'restoreTask';
  completeTask: 'completeTask';
  undoCompleteTask: 'undoCompleteTask';
  setRecurrence: 'setRecurrence';
  endRecurrence: 'endRecurrence';
  beginPlanning: 'beginPlanning';
  setAvailableHours: 'setAvailableHours';
  confirmSprint: 'confirmSprint';
  setGoal: 'updateGoal';
  assessGoal: 'updateGoal';
  addSprintTasks: 'addToSprint';
  createAndChooseTask: 'addToSprint';
  removeSprintTasks: 'removeSprintTask' | 'removeSprintTasks';
  setGoalLink: 'setGoalLink';
  excludeAllOccurrences: 'excludeAllOccurrences';
  setOccurrenceIncluded: 'includeOccurrence' | 'excludeOccurrence';
  includeOccurrences: 'includeOccurrences';
  chooseForToday: 'chooseForDay';
  addTaskToToday: 'chooseForDay';
  createTaskForToday: 'chooseForDay';
  startSelection: 'startSelection';
  pauseSelection: 'pauseSelection';
  deferSelection: 'deferSelection';
  undoDeferSelection: 'undoDeferSelection';
  removeFromToday: 'removeFromToday';
  undoRemoveFromToday: 'undoRemoveFromToday';
  completeSelection: 'completeSelection';
  undoCompleteSelection: 'undoCompleteSelection';
  skipSelection: 'skipSelection';
  undoSkipSelection: 'undoSkipSelection';
  recordActualTime: 'recordActualTime';
  noteInterrupt: 'noteInterrupt';
  editInterrupt: 'editInterrupt';
  deleteInterrupt: 'deleteInterrupt';
  restoreInterrupt: 'restoreInterrupt';
  beginRetro: 'beginRetro';
  setReflection: 'updateRetro';
  setImprovement: 'updateRetro';
  completeRetro: 'completeRetro';
  pinFact: 'pinFact';
  unpinFact: 'unpinFact';
  decideCriterion: 'decideCriterion';
  draftCriterion: 'draftCriterion';
  setDraftPolicy: 'setDraftPolicy';
  dropCriterionDraft: 'dropCriterionDraft';
};

/** The request of an operation: the surface and its parts. */
export type OperationRequest<S extends SurfaceId = SurfaceId> = {
  readonly operationId: S;
} & RequestParts<S>;

function to<S extends SurfaceId>(
  operationId: S,
  parts: RequestParts<S>,
): OperationRequest<S> {
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
  ) => OperationRequest<OperationSurfaces[N]>;
} = {
  // ---------------------------------------------------------------- Area
  createArea: (body) => to('createArea', { body }),
  renameArea: ({ areaId, name }) =>
    to('renameArea', { path: { areaId }, body: { name } }),
  archiveArea: (path) => to('archiveArea', { path }),
  restoreArea: (path) => to('restoreArea', { path }),

  // ---------------------------------------------------------------- Task
  createTask: (body) => to('createTask', { body }),
  saveTask: ({ taskId, update, estimate }) =>
    to('saveTask', {
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
  archiveTask: (path) => to('archiveTask', { path }),
  restoreTask: (path) => to('restoreTask', { path }),
  completeTask: (path) => to('completeTask', { path }),
  undoCompleteTask: (path) => to('undoCompleteTask', { path }),
  setRecurrence: ({ taskId, pattern }) =>
    to('setRecurrence', { path: { taskId }, body: { pattern } }),
  endRecurrence: (path) => to('endRecurrence', { path }),

  // -------------------------------------------------------------- Sprint
  beginPlanning: () => to('beginPlanning', {}),
  setAvailableHours: ({ sprintId, hours }) =>
    to('setAvailableHours', {
      path: { sprintId },
      body: { availableHours: hours },
    }),
  confirmSprint: ({ sprintId, applyCriterion }) =>
    to('confirmSprint', { path: { sprintId }, body: { applyCriterion } }),
  setGoal: ({ sprintId, areaId, text }) =>
    to('updateGoal', { path: { sprintId, areaId }, body: { text } }),
  assessGoal: ({ sprintId, areaId, assessment }) =>
    to('updateGoal', { path: { sprintId, areaId }, body: { assessment } }),
  addSprintTasks: ({ sprintId, taskIds }) =>
    to('addToSprint', { path: { sprintId }, body: { taskIds } }),
  createAndChooseTask: ({ sprintId, ...body }) =>
    to('addToSprint', { path: { sprintId }, body }),
  removeSprintTasks: ({ sprintId, sprintTaskIds }) => {
    const [only] = sprintTaskIds;
    return sprintTaskIds.length === 1 && only !== undefined
      ? to('removeSprintTask', { path: { sprintId, sprintTaskId: only } })
      : to('removeSprintTasks', {
          path: { sprintId },
          query: { ids: nonEmpty(sprintTaskIds, 'ids') },
        });
  },
  setGoalLink: ({ sprintId, sprintTaskId, goalLink }) =>
    to('setGoalLink', { path: { sprintId, sprintTaskId }, body: { goalLink } }),
  excludeAllOccurrences: (path) => to('excludeAllOccurrences', { path }),
  setOccurrenceIncluded: ({ sprintId, occurrenceId, included }) =>
    included
      ? to('includeOccurrence', { path: { sprintId, occurrenceId } })
      : to('excludeOccurrence', { path: { sprintId, occurrenceId } }),
  includeOccurrences: ({ sprintId, occurrenceIds }) =>
    to('includeOccurrences', { path: { sprintId }, body: { occurrenceIds } }),

  // --------------------------------------------------------------- Today
  chooseForToday: ({ sprintId, ...body }) =>
    to('chooseForDay', { path: { sprintId }, body }),
  addTaskToToday: ({ sprintId, ...body }) =>
    to('chooseForDay', { path: { sprintId }, body }),
  createTaskForToday: ({ sprintId, ...body }) =>
    to('chooseForDay', { path: { sprintId }, body }),
  startSelection: (path) => to('startSelection', { path }),
  pauseSelection: ({ sprintId, selectionId, ...body }) =>
    to('pauseSelection', { path: { sprintId, selectionId }, body }),
  deferSelection: (path) => to('deferSelection', { path }),
  undoDeferSelection: (path) => to('undoDeferSelection', { path }),
  removeFromToday: (path) => to('removeFromToday', { path }),
  undoRemoveFromToday: (path) => to('undoRemoveFromToday', { path }),
  completeSelection: (path) => to('completeSelection', { path }),
  undoCompleteSelection: (path) => to('undoCompleteSelection', { path }),
  skipSelection: (path) => to('skipSelection', { path }),
  undoSkipSelection: (path) => to('undoSkipSelection', { path }),
  recordActualTime: ({ sprintId, ...body }) =>
    to('recordActualTime', { path: { sprintId }, body }),
  noteInterrupt: ({ sprintId, ...body }) =>
    to('noteInterrupt', { path: { sprintId }, body }),
  editInterrupt: ({ sprintId, interruptNoteId, text, minutes }) =>
    to('editInterrupt', {
      path: { sprintId, interruptNoteId },
      body: { text, minutes: minutes ?? null },
    }),
  deleteInterrupt: (path) => to('deleteInterrupt', { path }),
  // The note as it was read, without what a read adds (its `etag`, #321):
  // the body takes the note's own values only.
  restoreInterrupt: ({ sprintId, note: { id, at, text, minutes } }) =>
    to('restoreInterrupt', {
      path: { sprintId, interruptNoteId: id },
      body: { at, text, ...(minutes === undefined ? {} : { minutes }) },
    }),

  // --------------------------------------------------------------- Retro
  beginRetro: (path) => to('beginRetro', { path }),
  setReflection: ({ sprintId, text }) =>
    to('updateRetro', { path: { sprintId }, body: { reflection: text } }),
  setImprovement: ({ sprintId, text }) =>
    to('updateRetro', { path: { sprintId }, body: { improvement: text } }),
  completeRetro: (path) => to('completeRetro', { path }),
  pinFact: ({ sprintId, pin }) =>
    to('pinFact', { path: { sprintId, ...pinPath(pin) } }),
  unpinFact: ({ sprintId, pin }) =>
    to('unpinFact', { path: { sprintId, ...pinPath(pin) } }),
  decideCriterion: ({ sprintId, decision }) =>
    to('decideCriterion', {
      path: { sprintId },
      body: { retroDecision: decision },
    }),

  // -------------------------------------------------- Planning criteria
  draftCriterion: ({ sprintId, policy }) =>
    to('draftCriterion', { body: { sourceSprintId: sprintId, policy } }),
  setDraftPolicy: ({ criterionId, policy }) =>
    to('setDraftPolicy', { path: { criterionId }, body: { policy } }),
  dropCriterionDraft: (path) => to('dropCriterionDraft', { path }),
};

/** The request of an operation and its input (the web app sends it). */
export function requestOf<N extends OperationName>(
  name: N,
  input: PlainInput<N>,
): OperationRequest<OperationSurfaces[N]> {
  return (
    requests[name] as (
      input: PlainInput<N>,
    ) => OperationRequest<OperationSurfaces[N]>
  )(input);
}

// ------------------------------------------------------ the idempotency key

/**
 * The header that names a write (ADR 0006 冪等キー), on every write of the
 * contract and on no read.
 */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/**
 * The header of a write named by `key`, a UUID (a new one for each write,
 * the same one when it is sent again): a Structured Field String, so in
 * double quotes (RFC 9651 §3.3.3).
 */
export function idempotencyKeyHeaders(key: string): {
  readonly 'Idempotency-Key': string;
} {
  return { [IDEMPOTENCY_KEY_HEADER]: `"${key}"` };
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

// ------------------------------------------------------ the record's version

/**
 * The operations whose surface takes `If-Match` (the PATCHes): each
 * replaces a record's values and names the version it was made from.
 */
export type ConditionalName = {
  [N in OperationName]: 'If-Match' extends keyof NonNullable<
    Datas[OperationSurfaces[N]]['headers']
  >
    ? N
    : never;
}[OperationName];

/**
 * What a write that replaces a record's values was made from (ADR 0006
 * 記録ごとの版, #321): the record's `etag` as read, or no record (a Goal not
 * written yet), which the write must not be made over.
 */
export type MadeFrom = { readonly etag: string } | { readonly none: true };

/**
 * The headers of a write made from `from` (RFC 9110 §13.1.1, §13.1.2):
 * `If-Match` with the etag, or `If-None-Match: *`.
 */
export function conditionHeaders(
  from: MadeFrom,
): { readonly 'If-Match': string } | { readonly 'If-None-Match': '*' } {
  return 'etag' in from ? { 'If-Match': from.etag } : { 'If-None-Match': '*' };
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
