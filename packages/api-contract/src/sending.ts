// How an operation of packages/application goes out as the contract's
// request (ADR 0006 経路の形): the surface it goes to (`routes`: the method,
// the path and the status) and its parts (`requestOf`), and the headers a
// write carries (`idempotencyKeyHeaders`, `conditionHeaders`). The web app
// sends with these.
//
// Nothing here checks a request: this module takes the contract's types
// only, not its Valibot schemas or Valibot itself, so a client that sends
// does not load them (ADR 0005 本番ビルド, #356). The way back, a received
// request read into its operation, is requests.ts's (services/api and the
// browser mock), which builds on this module.
import type {
  OperationInput,
  OperationName,
  OperationOutput,
} from '@itera/application';
import type * as c from './index';
import { issueAt, type ValidationIssue } from './problems';

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

/** A surface's request, as generated (`<OperationId>Data`). */
export type SurfaceData<S extends SurfaceId> = Datas[S];

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

/** A surface of the contract as HTTP carries it. */
export interface Route<S extends SurfaceId = SurfaceId> {
  readonly method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** The path under `/api`, `{name}` for a path value. */
  readonly url: Datas[S]['url'];
  /** The status when it went through: 201 made something, 204 returns nothing. */
  readonly status: keyof Responses[S] & (200 | 201 | 204);
}

/** Each write surface of the contract by its operationId. */
export const routes: { readonly [S in SurfaceId]: Route<S> } = {
  // ---------------------------------------------------------------- Area
  createArea: { method: 'POST', url: '/areas', status: 201 },
  renameArea: { method: 'PATCH', url: '/areas/{areaId}', status: 204 },
  archiveArea: { method: 'POST', url: '/areas/{areaId}/archive', status: 204 },
  restoreArea: { method: 'POST', url: '/areas/{areaId}/restore', status: 204 },

  // ---------------------------------------------------------------- Task
  createTask: { method: 'POST', url: '/tasks', status: 201 },
  saveTask: { method: 'PATCH', url: '/tasks/{taskId}', status: 204 },
  archiveTask: { method: 'POST', url: '/tasks/{taskId}/archive', status: 204 },
  restoreTask: { method: 'POST', url: '/tasks/{taskId}/restore', status: 204 },
  completeTask: {
    method: 'POST',
    url: '/tasks/{taskId}/complete',
    status: 204,
  },
  undoCompleteTask: {
    method: 'POST',
    url: '/tasks/{taskId}/undo-complete',
    status: 204,
  },
  setRecurrence: {
    method: 'PUT',
    url: '/tasks/{taskId}/recurrence',
    status: 200,
  },
  endRecurrence: {
    method: 'DELETE',
    url: '/tasks/{taskId}/recurrence',
    status: 200,
  },
  addSubtask: { method: 'POST', url: '/tasks/{taskId}/subtasks', status: 201 },
  updateSubtask: {
    method: 'PATCH',
    url: '/tasks/{taskId}/subtasks/{subtaskId}',
    status: 204,
  },
  adoptEstimateSuggestion: {
    method: 'POST',
    url: '/tasks/{taskId}/estimate-suggestions/{suggestionId}/adopt',
    status: 204,
  },
  undoAdoption: {
    method: 'POST',
    url: '/tasks/{taskId}/estimate-suggestions/{suggestionId}/undo-adopt',
    status: 204,
  },
  rejectSuggestion: {
    method: 'POST',
    url: '/tasks/{taskId}/estimate-suggestions/{suggestionId}/reject',
    status: 204,
  },
  undoRejection: {
    method: 'POST',
    url: '/tasks/{taskId}/estimate-suggestions/{suggestionId}/undo-reject',
    status: 204,
  },

  // -------------------------------------------------------------- Sprint
  beginPlanning: { method: 'POST', url: '/sprints', status: 201 },
  setAvailableHours: {
    method: 'PATCH',
    url: '/sprints/{sprintId}',
    status: 204,
  },
  confirmSprint: {
    method: 'POST',
    url: '/sprints/{sprintId}/confirm',
    status: 204,
  },
  updateGoal: {
    method: 'PATCH',
    url: '/sprints/{sprintId}/goals/{areaId}',
    status: 204,
  },
  addToSprint: {
    method: 'POST',
    url: '/sprints/{sprintId}/sprint-tasks',
    status: 201,
  },
  removeSprintTasks: {
    method: 'DELETE',
    url: '/sprints/{sprintId}/sprint-tasks',
    status: 204,
  },
  removeSprintTask: {
    method: 'DELETE',
    url: '/sprints/{sprintId}/sprint-tasks/{sprintTaskId}',
    status: 204,
  },
  setGoalLink: {
    method: 'PATCH',
    url: '/sprints/{sprintId}/sprint-tasks/{sprintTaskId}',
    status: 204,
  },
  excludeAllOccurrences: {
    method: 'POST',
    url: '/sprints/{sprintId}/sprint-tasks/{sprintTaskId}/exclude-occurrences',
    status: 204,
  },
  includeOccurrences: {
    method: 'POST',
    url: '/sprints/{sprintId}/included-occurrences',
    status: 204,
  },
  includeOccurrence: {
    method: 'PUT',
    url: '/sprints/{sprintId}/included-occurrences/{occurrenceId}',
    status: 204,
  },
  excludeOccurrence: {
    method: 'DELETE',
    url: '/sprints/{sprintId}/included-occurrences/{occurrenceId}',
    status: 204,
  },

  // --------------------------------------------------------------- Today
  chooseForDay: {
    method: 'POST',
    url: '/sprints/{sprintId}/daily-selections',
    status: 201,
  },
  startSelection: {
    method: 'POST',
    url: '/sprints/{sprintId}/daily-selections/{selectionId}/start',
    status: 204,
  },
  pauseSelection: {
    method: 'POST',
    url: '/sprints/{sprintId}/daily-selections/{selectionId}/pause',
    status: 204,
  },
  deferSelection: {
    method: 'POST',
    url: '/sprints/{sprintId}/daily-selections/{selectionId}/defer',
    status: 204,
  },
  undoDeferSelection: {
    method: 'POST',
    url: '/sprints/{sprintId}/daily-selections/{selectionId}/undo-defer',
    status: 204,
  },
  removeFromToday: {
    method: 'POST',
    url: '/sprints/{sprintId}/daily-selections/{selectionId}/remove',
    status: 204,
  },
  undoRemoveFromToday: {
    method: 'POST',
    url: '/sprints/{sprintId}/daily-selections/{selectionId}/undo-remove',
    status: 204,
  },
  completeSelection: {
    method: 'POST',
    url: '/sprints/{sprintId}/daily-selections/{selectionId}/complete',
    status: 204,
  },
  undoCompleteSelection: {
    method: 'POST',
    url: '/sprints/{sprintId}/daily-selections/{selectionId}/undo-complete',
    status: 204,
  },
  skipSelection: {
    method: 'POST',
    url: '/sprints/{sprintId}/daily-selections/{selectionId}/skip',
    status: 204,
  },
  undoSkipSelection: {
    method: 'POST',
    url: '/sprints/{sprintId}/daily-selections/{selectionId}/undo-skip',
    status: 204,
  },
  recordActualTime: {
    method: 'POST',
    url: '/sprints/{sprintId}/actual-times',
    status: 204,
  },
  noteInterrupt: {
    method: 'POST',
    url: '/sprints/{sprintId}/interrupts',
    status: 201,
  },
  editInterrupt: {
    method: 'PATCH',
    url: '/sprints/{sprintId}/interrupts/{interruptNoteId}',
    status: 204,
  },
  deleteInterrupt: {
    method: 'DELETE',
    url: '/sprints/{sprintId}/interrupts/{interruptNoteId}',
    status: 204,
  },
  restoreInterrupt: {
    method: 'PUT',
    url: '/sprints/{sprintId}/interrupts/{interruptNoteId}',
    status: 204,
  },

  // --------------------------------------------------------------- Retro
  beginRetro: { method: 'POST', url: '/sprints/{sprintId}/retro', status: 201 },
  updateRetro: {
    method: 'PATCH',
    url: '/sprints/{sprintId}/retro',
    status: 204,
  },
  completeRetro: {
    method: 'POST',
    url: '/sprints/{sprintId}/retro/complete',
    status: 204,
  },
  pinFact: {
    method: 'PUT',
    url: '/sprints/{sprintId}/retro/pins/{pin}',
    status: 204,
  },
  unpinFact: {
    method: 'DELETE',
    url: '/sprints/{sprintId}/retro/pins/{pin}',
    status: 204,
  },
  decideCriterion: {
    method: 'PATCH',
    url: '/sprints/{sprintId}/criterion-use',
    status: 204,
  },

  // -------------------------------------------------- Planning criteria
  draftCriterion: { method: 'POST', url: '/planning-criteria', status: 201 },
  setDraftPolicy: {
    method: 'PATCH',
    url: '/planning-criteria/{criterionId}',
    status: 204,
  },
  dropCriterionDraft: {
    method: 'DELETE',
    url: '/planning-criteria/{criterionId}',
    status: 204,
  },
};

/**
 * The settings as their write carries them (`PUT /me/settings`, outside
 * `routes`: no operation takes it).
 */
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

// ---------------------------------------------- an operation's request

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

// ------------------------------------------------------ the record's version

/**
 * The operations whose surface takes `If-Match` (the PATCHes, and the PUT
 * of a Task's rule, #330): each
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
 * written yet, a Task without a rule, #330), which the write must not be
 * made over.
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
