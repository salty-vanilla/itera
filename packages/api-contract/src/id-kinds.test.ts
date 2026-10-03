// Each operation's request body takes the same kind of ID in each property
// as packages/application's input (ADR 0004 ID の形式). The type tests
// compare IDs as plain strings, so this holds the kinds: the table below is
// checked against the application's types by `pnpm typecheck`, and against
// the contract's schemas here.
import {
  operations,
  type OperationInput,
  type OperationName,
} from '@itera/application';
import { describe, expect, it } from 'vitest';
import * as contract from './index';
import { idKindsOf, type IdKinds } from './testing';

type WithIds = {
  [
    N in OperationName as [IdKinds<OperationInput<N>>] extends [never]
      ? never
      : N
  ]: IdKinds<OperationInput<N>>;
};

/** The kinds of ID in each operation's input (the operations with any). */
const INPUT_ID_KINDS = {
  renameArea: { areaId: 'Area' },
  archiveArea: { areaId: 'Area' },
  restoreArea: { areaId: 'Area' },
  createTask: { areaId: 'Area' },
  saveTask: { taskId: 'Task', update: { areaId: 'Area' } },
  adoptSuggestion: { taskId: 'Task', suggestionId: 'EstimateSuggestion' },
  undoAdoption: { taskId: 'Task', suggestionId: 'EstimateSuggestion' },
  adoptEditedSuggestion: { taskId: 'Task', suggestionId: 'EstimateSuggestion' },
  rejectSuggestion: { taskId: 'Task', suggestionId: 'EstimateSuggestion' },
  undoRejection: { taskId: 'Task', suggestionId: 'EstimateSuggestion' },
  addSubtask: { taskId: 'Task' },
  setSubtaskDone: { taskId: 'Task', subtaskId: 'Subtask' },
  setSubtaskEstimate: { taskId: 'Task', subtaskId: 'Subtask' },
  archiveTask: { taskId: 'Task' },
  restoreTask: { taskId: 'Task' },
  completeTask: { taskId: 'Task' },
  undoCompleteTask: { taskId: 'Task' },
  addTaskToToday: { taskId: 'Task' },
  addTaskToWeek: { taskId: 'Task' },
  undoAddTaskToWeek: { taskId: 'Task' },
  setRecurrence: { taskId: 'Task' },
  endRecurrence: { taskId: 'Task' },
  chooseTasks: { taskIds: 'Task' },
  unchooseTasks: { sprintTaskIds: 'SprintTask' },
  unchooseTasksByTask: { taskIds: 'Task' },
  setOccurrenceIncluded: { occurrenceId: 'Occurrence' },
  includeOccurrences: { occurrenceIds: 'Occurrence' },
  excludeAllOccurrences: { sprintTaskId: 'SprintTask' },
  createAndChooseTask: { areaId: 'Area' },
  setPlanningGoal: { areaId: 'Area' },
  setGoalLink: { sprintTaskId: 'SprintTask' },
  chooseForToday: { sprintTaskId: 'SprintTask', occurrenceId: 'Occurrence' },
  startSelection: { selectionId: 'DailySelection' },
  deferSelection: { selectionId: 'DailySelection' },
  removeFromToday: { selectionId: 'DailySelection' },
  undoCloseSelection: { selectionId: 'DailySelection' },
  pauseSelection: { selectionId: 'DailySelection' },
  completeSelection: { selectionId: 'DailySelection' },
  undoCompleteSelection: { selectionId: 'DailySelection' },
  skipSelection: { selectionId: 'DailySelection' },
  undoSkipSelection: { selectionId: 'DailySelection' },
  recordSelectionActual: { selectionId: 'DailySelection' },
  editInterrupt: { interruptNoteId: 'InterruptNote' },
  deleteInterrupt: { interruptNoteId: 'InterruptNote' },
  restoreInterrupt: { note: { id: 'InterruptNote' } },
  createTaskForToday: { areaId: 'Area' },
  setRunningGoal: { areaId: 'Area' },
  undoPastDay: { selectionId: 'DailySelection' },
  assessGoal: { areaId: 'Area' },
  recordReviewActual: {
    sprintTaskId: 'SprintTask',
    occurrenceId: 'Occurrence',
  },
} as const satisfies WithIds;

// Every operation with an ID in its input is in the table.
const complete: Record<keyof WithIds, unknown> = INPUT_ID_KINDS;
void complete;

describe("each operation's request body", () => {
  it.each(Object.keys(operations))(
    '%s takes the kinds of ID the operation takes',
    (name) => {
      const body = (contract as Record<string, unknown>)[
        `v${name.charAt(0).toUpperCase()}${name.slice(1)}Body`
      ];
      const kinds = (INPUT_ID_KINDS as Record<string, unknown>)[name];
      expect(body === undefined ? undefined : idKindsOf(body)).toEqual(kinds);
    },
  );
});
