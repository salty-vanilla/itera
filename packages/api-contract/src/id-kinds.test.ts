// Each operation's request takes the same kind of ID in each place as
// packages/application's input (ADR 0004 ID の形式). The type tests compare
// IDs as plain strings, so this holds the kinds: the table below is checked
// against the application's types by `pnpm typecheck`, and here each ID of
// each example input (testing.ts), sent as its request, is refused by the
// contract's schemas when it is another kind's.
import type { OperationInput, OperationName } from '@itera/application';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { requestOf, surfaces, type PlainInput, type Surface } from './requests';
import { newId, OPERATION_EXAMPLES, type IdKinds } from './testing';

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
  setRecurrence: { taskId: 'Task' },
  endRecurrence: { taskId: 'Task' },
  setAvailableHours: { sprintId: 'Sprint' },
  confirmSprint: { sprintId: 'Sprint' },
  setGoal: { sprintId: 'Sprint', areaId: 'Area' },
  assessGoal: { sprintId: 'Sprint', areaId: 'Area' },
  addSprintTasks: { sprintId: 'Sprint', taskIds: 'Task' },
  createAndChooseTask: { sprintId: 'Sprint', areaId: 'Area' },
  removeSprintTasks: { sprintId: 'Sprint', sprintTaskIds: 'SprintTask' },
  setGoalLink: { sprintId: 'Sprint', sprintTaskId: 'SprintTask' },
  excludeAllOccurrences: { sprintId: 'Sprint', sprintTaskId: 'SprintTask' },
  setOccurrenceIncluded: { sprintId: 'Sprint', occurrenceId: 'Occurrence' },
  includeOccurrences: { sprintId: 'Sprint', occurrenceIds: 'Occurrence' },
  chooseForToday: {
    sprintId: 'Sprint',
    sprintTaskId: 'SprintTask',
    occurrenceId: 'Occurrence',
  },
  addTaskToToday: { sprintId: 'Sprint', taskId: 'Task' },
  createTaskForToday: { sprintId: 'Sprint', areaId: 'Area' },
  startSelection: { sprintId: 'Sprint', selectionId: 'DailySelection' },
  pauseSelection: { sprintId: 'Sprint', selectionId: 'DailySelection' },
  deferSelection: { sprintId: 'Sprint', selectionId: 'DailySelection' },
  undoDeferSelection: { sprintId: 'Sprint', selectionId: 'DailySelection' },
  removeFromToday: { sprintId: 'Sprint', selectionId: 'DailySelection' },
  undoRemoveFromToday: { sprintId: 'Sprint', selectionId: 'DailySelection' },
  completeSelection: { sprintId: 'Sprint', selectionId: 'DailySelection' },
  undoCompleteSelection: { sprintId: 'Sprint', selectionId: 'DailySelection' },
  skipSelection: { sprintId: 'Sprint', selectionId: 'DailySelection' },
  undoSkipSelection: { sprintId: 'Sprint', selectionId: 'DailySelection' },
  recordActualTime: {
    sprintId: 'Sprint',
    sprintTaskId: 'SprintTask',
    occurrenceId: 'Occurrence',
  },
  noteInterrupt: { sprintId: 'Sprint' },
  editInterrupt: { sprintId: 'Sprint', interruptNoteId: 'InterruptNote' },
  deleteInterrupt: { sprintId: 'Sprint', interruptNoteId: 'InterruptNote' },
  restoreInterrupt: { sprintId: 'Sprint', note: { id: 'InterruptNote' } },
  beginRetro: { sprintId: 'Sprint' },
  setReflection: { sprintId: 'Sprint' },
  setImprovement: { sprintId: 'Sprint' },
  completeRetro: { sprintId: 'Sprint' },
  pinFact: { sprintId: 'Sprint' },
  unpinFact: { sprintId: 'Sprint' },
  decideCriterion: { sprintId: 'Sprint' },
  draftCriterion: { sprintId: 'Sprint' },
  setDraftPolicy: { criterionId: 'PlanningCriterion' },
  dropCriterionDraft: { criterionId: 'PlanningCriterion' },
} as const satisfies WithIds;

// Every operation with an ID in its input is in the table.
const complete: Record<keyof WithIds, unknown> = INPUT_ID_KINDS;
void complete;

type Kinds = { readonly [key: string]: string | Kinds };

/** The paths in the input to its IDs (`note.id`, `taskIds[0]`), with the kind. */
function idsIn(input: unknown, kinds: Kinds, at: string[] = []) {
  const found: [string[], string][] = [];
  for (const [key, kind] of Object.entries(kinds)) {
    const value = (input as Record<string, unknown> | undefined)?.[key];
    if (value === undefined || value === null) continue;
    if (typeof kind !== 'string') {
      found.push(...idsIn(value, kind, [...at, key]));
    } else if (Array.isArray(value)) {
      value.forEach((_, i) => found.push([[...at, key, String(i)], kind]));
    } else found.push([[...at, key], kind]);
  }
  return found;
}

function replaced(
  input: unknown,
  [key, ...rest]: string[],
  value: unknown,
): unknown {
  if (key === undefined) return value;
  const copy: Record<string, unknown> = Array.isArray(input)
    ? ([...(input as unknown[])] as unknown as Record<string, unknown>)
    : { ...(input as Record<string, unknown>) };
  copy[key] = replaced(copy[key], rest, value);
  return copy;
}

/** Whether the contract's schemas take the operation's request. */
function accepted(name: OperationName, input: unknown) {
  const request = requestOf(name, input as PlainInput<typeof name>);
  const surface = surfaces[request.operationId] as unknown as Surface;
  return (['path', 'query', 'body'] as const).every(
    (part) =>
      surface[part] === undefined ||
      v.is(surface[part], (request as Record<string, unknown>)[part]),
  );
}

describe("each operation's request", () => {
  it.each(Object.keys(OPERATION_EXAMPLES) as OperationName[])(
    '%s takes the kinds of ID the operation takes',
    (name) => {
      const kinds = (INPUT_ID_KINDS as Record<string, Kinds>)[name] ?? {};
      for (const input of OPERATION_EXAMPLES[name]) {
        expect(accepted(name, input)).toBe(true);
        for (const [path, kind] of idsIn(input, kinds)) {
          const other = newId(kind === 'Task' ? 'Area' : 'Task');
          expect(
            accepted(name, replaced(input, path, other)),
            path.join('.'),
          ).toBe(false);
        }
      }
    },
  );

  it('names the fact it pins by its kind of ID', () => {
    for (const name of ['pinFact', 'unpinFact'] as const) {
      expect(
        accepted(name, {
          sprintId: newId('Sprint'),
          pin: { kind: 'sprintTask', id: newId('Task') },
        }),
      ).toBe(false);
    }
  });
});
