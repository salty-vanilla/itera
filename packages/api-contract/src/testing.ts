// Helpers for the tests that hold the contract against packages/application.
import {
  createIdSource,
  type OperationInput,
  type OperationName,
} from '@itera/application';
import { instant, localDate, type Id } from '@itera/domain';
import * as contract from './index';
import { surfaces, type OperationRequest } from './requests';

export type { Plain } from './requests';

/** A read's result as the response carries it: `undefined` becomes `null`. */
export type WithNull<T> =
  Exclude<T, undefined> | (undefined extends T ? null : never);

/** Whether two types are the same (not only assignable both ways). */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** The ID schemas of the contract, by the kind of ID (packages/domain). */
export const ID_SCHEMAS = {
  User: contract.vUserId,
  Area: contract.vAreaId,
  Task: contract.vTaskId,
  Subtask: contract.vSubtaskId,
  EstimateSuggestion: contract.vEstimateSuggestionId,
  RecurrenceRule: contract.vRecurrenceRuleId,
  Occurrence: contract.vOccurrenceId,
  Sprint: contract.vSprintId,
  SprintTask: contract.vSprintTaskId,
  DailySelection: contract.vDailySelectionId,
  InterruptNote: contract.vInterruptNoteId,
  PlanningCriterion: contract.vPlanningCriterionId,
} as const;

type Schema = {
  readonly type?: string;
  readonly entries?: Record<string, unknown>;
  readonly wrapped?: unknown;
  readonly item?: unknown;
  readonly options?: readonly unknown[];
};

/**
 * Which kind of ID each property of a Valibot schema takes, as the contract
 * says: the kind's name for an ID (or a list of them), the same for an
 * object's properties, and `undefined` where there is no ID. A union of
 * shapes is not followed (the reads' fixture test covers those).
 */
export function idKindsOf(schema: unknown): unknown {
  const kind = Object.entries(ID_SCHEMAS).find(([, s]) => s === schema)?.[0];
  if (kind !== undefined) return kind;
  const s = schema as Schema;
  if (s.wrapped !== undefined) return idKindsOf(s.wrapped);
  if (s.type === 'array') return idKindsOf(s.item);
  if (s.entries !== undefined) {
    const kinds = Object.entries(s.entries).flatMap(([key, value]) => {
      const of = idKindsOf(value);
      return of === undefined ? [] : [[key, of] as const];
    });
    return kinds.length === 0 ? undefined : Object.fromEntries(kinds);
  }
  return undefined;
}

/**
 * Which kind of ID each property of a type takes, as packages/domain's
 * branded IDs say: the same shape as `idKindsOf` gives for the contract.
 * Unions of shapes are not followed, as there.
 */
export type IdKinds<T> = [KindOf<T>] extends [never]
  ? [T] extends [object]
    ? ObjectKinds<T>
    : never
  : KindOf<T>;

type KindOf<T> = T extends Id<infer Kind> ? Kind : never;
type Item<T> = NonNullable<T> extends readonly (infer U)[] ? U : NonNullable<T>;
type IsUnion<T, U = T> = T extends unknown
  ? [U] extends [T]
    ? false
    : true
  : never;
type ObjectKinds<T> =
  IsUnion<T> extends true
    ? never
    : {
          [
            K in keyof T as [IdKinds<Item<T[K]>>] extends [never] ? never : K
          ]-?: IdKinds<Item<T[K]>>;
        } extends infer O
      ? [keyof O] extends [never]
        ? never
        : O
      : never;

let seed = 7;
const idSource = createIdSource((bytes) => {
  for (let i = 0; i < bytes.length; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    bytes[i] = seed % 256;
  }
});

/** A new ID of the kind, as the server makes them. */
export const newId = <Kind extends keyof typeof ID_SCHEMAS>(kind: Kind) =>
  idSource.newId(kind, instant('2026-10-03T00:00:00.000Z'));

const area = newId('Area');
const task = newId('Task');
const subtask = newId('Subtask');
const suggestion = newId('EstimateSuggestion');
const occurrence = newId('Occurrence');
const sprintTask = newId('SprintTask');
const selection = newId('DailySelection');
const interrupt = newId('InterruptNote');
const sprint = newId('Sprint');
const criterion = newId('PlanningCriterion');
const at = instant('2026-10-03T01:02:03.000Z');
const date = localDate('2026-10-02');
const policy = {
  scope: { kind: 'area', areaId: area },
  rangePolicy: 'hi',
} as const;

/**
 * An input of each operation, with every optional property that changes
 * its request (requests.test.ts sends each through the contract and back).
 */
export const OPERATION_EXAMPLES: {
  readonly [N in OperationName]: readonly OperationInput<N>[];
} = {
  createArea: [{ name: '研究' }],
  renameArea: [{ areaId: area, name: '仕事' }],
  archiveArea: [{ areaId: area }],
  restoreArea: [{ areaId: area }],
  createTask: [{ title: '論文を読む' }, { title: '論文を読む', areaId: area }],
  saveTask: [
    {
      taskId: task,
      update: {
        title: '論文を読む',
        description: '3 章まで',
        areaId: area,
        due: date,
        priority: 'high',
        timeBasis: 'subtasks',
      },
      estimate: 2,
    },
    { taskId: task, update: { areaId: null, due: null }, estimate: null },
    { taskId: task, update: {} },
  ],
  adoptSuggestion: [{ taskId: task, suggestionId: suggestion, bound: 'mid' }],
  undoAdoption: [
    {
      taskId: task,
      suggestionId: suggestion,
      previous: { hours: 3, setAt: at, source: { kind: 'manual' } },
    },
    { taskId: task, suggestionId: suggestion, previous: null },
  ],
  adoptEditedSuggestion: [
    { taskId: task, suggestionId: suggestion, hours: 1.5 },
  ],
  rejectSuggestion: [{ taskId: task, suggestionId: suggestion }],
  undoRejection: [{ taskId: task, suggestionId: suggestion }],
  addSubtask: [
    { taskId: task, title: '図を描く' },
    { taskId: task, title: '図を描く', hours: 1 },
  ],
  setSubtaskDone: [{ taskId: task, subtaskId: subtask, done: true }],
  setSubtaskEstimate: [
    { taskId: task, subtaskId: subtask, hours: 0.5 },
    { taskId: task, subtaskId: subtask, hours: null },
  ],
  archiveTask: [{ taskId: task }],
  restoreTask: [{ taskId: task }],
  completeTask: [{ taskId: task }],
  undoCompleteTask: [{ taskId: task }],
  setRecurrence: [
    { taskId: task, pattern: { freq: 'weekly', daysOfWeek: [1, 3] } },
  ],
  endRecurrence: [{ taskId: task }],
  beginPlanning: [undefined],
  setAvailableHours: [
    { sprintId: sprint, hours: 20 },
    { sprintId: sprint, hours: null },
  ],
  confirmSprint: [{ sprintId: sprint, applyCriterion: true }],
  setGoal: [{ sprintId: sprint, areaId: area, text: '1 本書き上げる' }],
  assessGoal: [
    { sprintId: sprint, areaId: area, assessment: 'partly' },
    { sprintId: sprint, areaId: area, assessment: null },
  ],
  addSprintTasks: [{ sprintId: sprint, taskIds: [task, newId('Task')] }],
  createAndChooseTask: [
    { sprintId: sprint, title: '発表の準備' },
    { sprintId: sprint, title: '発表の準備', areaId: area },
  ],
  removeSprintTasks: [
    { sprintId: sprint, sprintTaskIds: [sprintTask, newId('SprintTask')] },
    { sprintId: sprint, sprintTaskIds: [sprintTask] },
  ],
  setGoalLink: [
    { sprintId: sprint, sprintTaskId: sprintTask, goalLink: 'unlinked' },
  ],
  excludeAllOccurrences: [{ sprintId: sprint, sprintTaskId: sprintTask }],
  setOccurrenceIncluded: [
    { sprintId: sprint, occurrenceId: occurrence, included: true },
    { sprintId: sprint, occurrenceId: occurrence, included: false },
  ],
  includeOccurrences: [
    { sprintId: sprint, occurrenceIds: [occurrence, newId('Occurrence')] },
  ],
  chooseForToday: [
    { sprintId: sprint, date, sprintTaskId: sprintTask },
    {
      sprintId: sprint,
      date,
      sprintTaskId: sprintTask,
      occurrenceId: occurrence,
    },
  ],
  addTaskToToday: [{ sprintId: sprint, date, taskId: task }],
  createTaskForToday: [
    { sprintId: sprint, date, title: '返信する' },
    { sprintId: sprint, date, title: '返信する', areaId: area },
  ],
  startSelection: [{ sprintId: sprint, selectionId: selection }],
  pauseSelection: [
    { sprintId: sprint, selectionId: selection },
    { sprintId: sprint, selectionId: selection, hours: 1 },
  ],
  deferSelection: [{ sprintId: sprint, selectionId: selection }],
  undoDeferSelection: [{ sprintId: sprint, selectionId: selection }],
  removeFromToday: [{ sprintId: sprint, selectionId: selection }],
  undoRemoveFromToday: [{ sprintId: sprint, selectionId: selection }],
  completeSelection: [{ sprintId: sprint, selectionId: selection }],
  undoCompleteSelection: [{ sprintId: sprint, selectionId: selection }],
  skipSelection: [{ sprintId: sprint, selectionId: selection }],
  undoSkipSelection: [{ sprintId: sprint, selectionId: selection }],
  recordActualTime: [
    { sprintId: sprint, sprintTaskId: sprintTask, date, hours: 1 },
    {
      sprintId: sprint,
      sprintTaskId: sprintTask,
      date,
      hours: 1,
      occurrenceId: occurrence,
    },
  ],
  noteInterrupt: [
    { sprintId: sprint, text: '電話' },
    { sprintId: sprint, text: '電話', minutes: 15 },
  ],
  editInterrupt: [
    { sprintId: sprint, interruptNoteId: interrupt, text: '来客' },
    { sprintId: sprint, interruptNoteId: interrupt, text: '来客', minutes: 30 },
  ],
  deleteInterrupt: [{ sprintId: sprint, interruptNoteId: interrupt }],
  restoreInterrupt: [
    { sprintId: sprint, note: { id: interrupt, at, text: '電話' } },
    {
      sprintId: sprint,
      note: { id: interrupt, at, text: '電話', minutes: 15 },
    },
  ],
  beginRetro: [{ sprintId: sprint }],
  setReflection: [{ sprintId: sprint, text: '見送りが多かった' }],
  setImprovement: [{ sprintId: sprint, text: '1 本ずつに分ける' }],
  completeRetro: [{ sprintId: sprint }],
  pinFact: [
    { sprintId: sprint, pin: { kind: 'sprintTask', id: sprintTask } },
    { sprintId: sprint, pin: { kind: 'dailySelection', id: selection } },
    { sprintId: sprint, pin: { kind: 'occurrence', id: occurrence } },
    { sprintId: sprint, pin: { kind: 'interrupt', id: interrupt } },
    { sprintId: sprint, pin: { kind: 'goal', id: area } },
    { sprintId: sprint, pin: { kind: 'availableHours' } },
  ],
  unpinFact: [
    { sprintId: sprint, pin: { kind: 'sprintTask', id: sprintTask } },
    { sprintId: sprint, pin: { kind: 'availableHours' } },
  ],
  decideCriterion: [{ sprintId: sprint, decision: 'replace' }],
  draftCriterion: [{ sprintId: sprint, policy }],
  setDraftPolicy: [
    {
      criterionId: criterion,
      policy: { scope: { kind: 'all' }, rangePolicy: 'lo' },
    },
  ],
  dropCriterionDraft: [{ criterionId: criterion }],
};

/**
 * An operation's request as HTTP: the surface's method, its path under
 * `/api` with the path's values, the query (a list as the name repeated, as
 * the generated client sends it) and the JSON body.
 */
export function httpOf(request: OperationRequest): {
  readonly method: string;
  readonly url: string;
  readonly body?: string;
} {
  const { method, url } = surfaces[request.operationId];
  const values = (request.path ?? {}) as Record<string, string>;
  const path = url.replace(/\{(\w+)\}/g, (_, key: string) =>
    encodeURIComponent(values[key]!),
  );
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(request.query ?? {}))
    for (const item of [value].flat()) query.append(key, String(item));
  const search = query.size === 0 ? '' : `?${query}`;
  return {
    method,
    url: `/api${path}${search}`,
    ...(request.body === undefined
      ? {}
      : { body: JSON.stringify(request.body) }),
  };
}
