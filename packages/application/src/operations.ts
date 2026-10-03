// The person's operations, one name each, with their input and what they
// return (ADR 0005: one operation of the person is one named function).
// The names are unique across the screens, so that they can become the
// operations of the API's contract (#265); the API and the browser mock
// run them by name. The system's own records (the end of a Sprint, the
// start of a day) are not here: the server runs them (system-changes.ts).
import type {
  AreaId,
  CriterionPolicy,
  DailySelectionId,
  Estimate,
  EstimateSuggestionId,
  GoalLink,
  InterruptNote,
  InterruptNoteId,
  LocalDate,
  OccurrenceId,
  RecurrencePattern,
  RetroDecision,
  RetroPin,
  SelfAssessment,
  SprintTaskId,
  SubtaskId,
  SuggestionBound,
  TaskAttributeUpdate,
  TaskId,
  Result,
} from '@itera/domain';
import * as area from './area-changes';
import * as planning from './planning-changes';
import type { Change, ChangeContext } from './record-store';
import type { Records } from './records';
import * as retro from './retro-changes';
import * as running from './running-changes';
import * as task from './task-changes';
import * as today from './today-changes';

type OnTask = { readonly taskId: TaskId };
type OnSuggestion = OnTask & {
  readonly suggestionId: EstimateSuggestionId;
};
type OnSubtask = OnTask & { readonly subtaskId: SubtaskId };
type OnSelection = { readonly selectionId: DailySelectionId };
type NewTask = { readonly title: string; readonly areaId?: AreaId };
type OnInterrupt = { readonly interruptNoteId: InterruptNoteId };
type InterruptText = { readonly text: string; readonly minutes?: number };

export const operations = {
  // ---------------------------------------------------------------- Area
  /** A new Area, last in the order and in the next color. */
  createArea: ({ name }: { readonly name: string }) => area.addArea(name),
  renameArea: ({
    areaId,
    name,
  }: {
    readonly areaId: AreaId;
    readonly name: string;
  }) => area.rename(areaId, name),
  archiveArea: ({ areaId }: { readonly areaId: AreaId }) =>
    area.archive(areaId),
  restoreArea: ({ areaId }: { readonly areaId: AreaId }) =>
    area.restore(areaId),

  // ------------------------------------------------- Task (Backlog, detail)
  /** Quick Add in the Backlog. */
  createTask: ({ title, areaId }: NewTask) => task.addTask(title, areaId),
  /** The detail's form: attributes and the Estimate, saved together. */
  saveTask: ({
    taskId,
    update,
    estimate,
  }: OnTask & {
    readonly update: TaskAttributeUpdate;
    /** Hours, `null` to clear it, absent to leave it. */
    readonly estimate?: number | null;
  }) => task.saveTask(taskId, update, estimate),
  adoptSuggestion: ({
    taskId,
    suggestionId,
    bound,
  }: OnSuggestion & { readonly bound: SuggestionBound }) =>
    task.adopt(taskId, suggestionId, bound),
  undoAdoption: ({
    taskId,
    suggestionId,
    previous,
  }: OnSuggestion & { readonly previous: Estimate | null }) =>
    task.undoAdopt(taskId, suggestionId, previous),
  adoptEditedSuggestion: ({
    taskId,
    suggestionId,
    hours,
  }: OnSuggestion & { readonly hours: number }) =>
    task.adoptEdited(taskId, suggestionId, hours),
  rejectSuggestion: ({ taskId, suggestionId }: OnSuggestion) =>
    task.reject(taskId, suggestionId),
  undoRejection: ({ taskId, suggestionId }: OnSuggestion) =>
    task.undoReject(taskId, suggestionId),
  addSubtask: ({
    taskId,
    title,
    hours,
  }: OnTask & { readonly title: string; readonly hours?: number }) =>
    task.addTaskSubtask(taskId, title, hours),
  setSubtaskDone: ({
    taskId,
    subtaskId,
    done,
  }: OnSubtask & { readonly done: boolean }) =>
    task.toggleSubtask(taskId, subtaskId, done),
  setSubtaskEstimate: ({
    taskId,
    subtaskId,
    hours,
  }: OnSubtask & { readonly hours: number | null }) =>
    task.estimateSubtask(taskId, subtaskId, hours),
  archiveTask: ({ taskId }: OnTask) => task.archive(taskId),
  restoreTask: ({ taskId }: OnTask) => task.restore(taskId),
  /** 完了にする in the Backlog (with today's selection in a Sprint). */
  completeTask: ({ taskId }: OnTask) => task.complete(taskId),
  undoCompleteTask: ({ taskId }: OnTask) => task.undoComplete(taskId),
  /** 今日へ for a Task outside the active Sprint. */
  addTaskToToday: ({ taskId }: OnTask) => task.toToday(taskId),
  /** 今週へ for a Task outside the active Sprint (#155). */
  addTaskToWeek: ({ taskId }: OnTask) => task.toWeek(taskId),
  undoAddTaskToWeek: ({ taskId }: OnTask) => task.undoToWeek(taskId),
  setRecurrence: ({
    taskId,
    pattern,
  }: OnTask & { readonly pattern: RecurrencePattern }) =>
    task.setRule(taskId, pattern),
  endRecurrence: ({ taskId }: OnTask) => task.endRule(taskId),

  // ------------------------------------------------------------- Planning
  chooseTasks: ({ taskIds }: { readonly taskIds: readonly TaskId[] }) =>
    planning.chooseTasks(taskIds),
  unchooseTasks: ({
    sprintTaskIds,
  }: {
    readonly sprintTaskIds: readonly SprintTaskId[];
  }) => planning.unchooseTasks(sprintTaskIds),
  /** 元に戻す after chooseTasks. */
  unchooseTasksByTask: ({ taskIds }: { readonly taskIds: readonly TaskId[] }) =>
    planning.unchooseByTask(taskIds),
  setOccurrenceIncluded: ({
    occurrenceId,
    included,
  }: {
    readonly occurrenceId: OccurrenceId;
    readonly included: boolean;
  }) => planning.setOccurrenceIncluded(occurrenceId, included),
  includeOccurrences: ({
    occurrenceIds,
  }: {
    readonly occurrenceIds: readonly OccurrenceId[];
  }) => planning.includeOccurrences(occurrenceIds),
  excludeAllOccurrences: ({
    sprintTaskId,
  }: {
    readonly sprintTaskId: SprintTaskId;
  }) => planning.excludeAllOccurrences(sprintTaskId),
  /** Planning で追加: a new Task, chosen at once. */
  createAndChooseTask: ({ title, areaId }: NewTask) =>
    planning.addAndChoose(title, areaId),
  setPlanningGoal: ({
    areaId,
    text,
  }: {
    readonly areaId: AreaId;
    readonly text: string;
  }) => planning.setGoal(areaId, text),
  setGoalLink: ({
    sprintTaskId,
    goalLink,
  }: {
    readonly sprintTaskId: SprintTaskId;
    readonly goalLink: GoalLink;
  }) => planning.setLink(sprintTaskId, goalLink),
  setPlanningAvailableHours: ({ hours }: { readonly hours: number | null }) =>
    planning.setHours(hours),
  confirmSprint: ({ applyCriterion }: { readonly applyCriterion: boolean }) =>
    planning.confirm(applyCriterion),

  // ---------------------------------------------------------------- Today
  chooseForToday: ({
    sprintTaskId,
    occurrenceId,
  }: {
    readonly sprintTaskId: SprintTaskId;
    readonly occurrenceId?: OccurrenceId;
  }) => today.choose(sprintTaskId, occurrenceId),
  startSelection: ({ selectionId }: OnSelection) => today.start(selectionId),
  deferSelection: ({ selectionId }: OnSelection) => today.defer(selectionId),
  removeFromToday: ({ selectionId }: OnSelection) => today.remove(selectionId),
  /** Takes back 見送り or 今週の残りに戻す, today only. */
  undoCloseSelection: ({ selectionId }: OnSelection) =>
    today.undoClose(selectionId),
  pauseSelection: ({
    selectionId,
    hours,
  }: OnSelection & { readonly hours?: number }) =>
    today.pause(selectionId, hours),
  completeSelection: ({ selectionId }: OnSelection) =>
    today.complete(selectionId),
  undoCompleteSelection: ({ selectionId }: OnSelection) =>
    today.undoComplete(selectionId),
  skipSelection: ({ selectionId }: OnSelection) => today.skip(selectionId),
  undoSkipSelection: ({ selectionId }: OnSelection) =>
    today.undoSkip(selectionId),
  /** Actual hours of a selection, on its day. */
  recordSelectionActual: ({
    selectionId,
    hours,
  }: OnSelection & { readonly hours: number }) =>
    today.recordActual(selectionId, hours),
  noteInterrupt: ({ text, minutes }: InterruptText) =>
    today.interrupt(text, minutes),
  editInterrupt: ({
    interruptNoteId,
    text,
    minutes,
  }: OnInterrupt & InterruptText) =>
    today.editNote(interruptNoteId, text, minutes),
  deleteInterrupt: ({ interruptNoteId }: OnInterrupt) =>
    today.deleteNote(interruptNoteId),
  restoreInterrupt: ({ note }: { readonly note: InterruptNote }) =>
    today.restoreNote(note),
  /** Today's quick add: a new Task, in the Sprint and chosen for today. */
  createTaskForToday: ({ title, areaId }: NewTask) =>
    today.addAndChoose(title, areaId),
  /** Retro を始める, from the last day (F21). */
  beginRetro: () => today.beginRetro(),

  // ------------------------------------------------- Sprint after confirm
  setRunningGoal: ({
    areaId,
    text,
  }: {
    readonly areaId: AreaId;
    readonly text: string;
  }) => running.setGoal(areaId, text),
  setRunningAvailableHours: ({ hours }: { readonly hours: number | null }) =>
    running.setHours(hours),
  /** 過去の日の完了・スキップを取り消す (#53). */
  undoPastDay: ({ selectionId }: OnSelection) =>
    running.undoPastDay(selectionId),

  // ---------------------------------------------------------------- Retro
  assessGoal: ({
    areaId,
    assessment,
  }: {
    readonly areaId: AreaId;
    readonly assessment: SelfAssessment | null;
  }) => retro.assess(areaId, assessment),
  togglePin: ({ pin }: { readonly pin: RetroPin }) => retro.pin(pin),
  setReflection: ({ text }: { readonly text: string }) => retro.reflect(text),
  setImprovement: ({ text }: { readonly text: string }) => retro.improve(text),
  draftCriterion: ({ policy }: { readonly policy: CriterionPolicy }) =>
    retro.draft(policy),
  setDraftPolicy: ({ policy }: { readonly policy: CriterionPolicy }) =>
    retro.setDraft(policy),
  dropCriterionDraft: () => retro.dropDraft(),
  decideCriterion: ({ decision }: { readonly decision: RetroDecision }) =>
    retro.decide(decision),
  /** Actual hours added in Review (F22). */
  recordReviewActual: ({
    sprintTaskId,
    hours,
    date,
    occurrenceId,
  }: {
    readonly sprintTaskId: SprintTaskId;
    readonly hours: number;
    readonly date: LocalDate;
    readonly occurrenceId?: OccurrenceId;
  }) => retro.recordActual(sprintTaskId, hours, date, occurrenceId),
  completeRetro: () => retro.complete(),
  /** 計画を始める for the next week not confirmed yet. */
  beginPlanning: () => retro.beginPlanning(),
} satisfies Record<
  string,
  (input: never) => (records: Records, ctx: ChangeContext) => Result<object>
>;

export type Operations = typeof operations;
export type OperationName = keyof Operations;
export type OperationInput<Name extends OperationName> = Parameters<
  Operations[Name]
>[0];
export type OperationOutput<Name extends OperationName> =
  ReturnType<Operations[Name]> extends Change<infer T> ? T : never;
