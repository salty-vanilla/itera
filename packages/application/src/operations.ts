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
  PlanningCriterionId,
  RecurrencePattern,
  RetroDecision,
  RetroPin,
  SelfAssessment,
  SprintId,
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
import * as sprint from './sprint-changes';
import * as task from './task-changes';
import * as today from './today-changes';

type OnTask = { readonly taskId: TaskId };
/** The Sprint the operation is on: the request names it (#295). */
type OnSprint = { readonly sprintId: SprintId };
/** A choice for today names the day too, which must be today (#295 W3). */
type ForToday = OnSprint & { readonly date: LocalDate };
type OnCriterion = { readonly criterionId: PlanningCriterionId };
type OnSuggestion = OnTask & {
  readonly suggestionId: EstimateSuggestionId;
};
type OnSubtask = OnTask & { readonly subtaskId: SubtaskId };
type OnSelection = OnSprint & { readonly selectionId: DailySelectionId };
type NewTask = { readonly title: string; readonly areaId?: AreaId };
type OnInterrupt = OnSprint & { readonly interruptNoteId: InterruptNoteId };
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
  setRecurrence: ({
    taskId,
    pattern,
  }: OnTask & { readonly pattern: RecurrencePattern }) =>
    task.setRule(taskId, pattern),
  endRecurrence: ({ taskId }: OnTask) => task.endRule(taskId),

  // -------------------------------------------- Sprint (planned, running)
  /** 計画を始める for the next week not confirmed yet. */
  beginPlanning: () => retro.beginPlanning(),
  setAvailableHours: ({
    sprintId,
    hours,
  }: OnSprint & { readonly hours: number | null }) =>
    sprint.setHours(sprintId, hours),
  confirmSprint: ({
    sprintId,
    applyCriterion,
  }: OnSprint & { readonly applyCriterion: boolean }) =>
    planning.confirm(sprintId, applyCriterion),
  setGoal: ({
    sprintId,
    areaId,
    text,
  }: OnSprint & { readonly areaId: AreaId; readonly text: string }) =>
    sprint.setGoal(sprintId, areaId, text),
  /** Tasks join the Sprint: drafts while planned, additions while running. */
  addSprintTasks: ({
    sprintId,
    taskIds,
  }: OnSprint & { readonly taskIds: readonly TaskId[] }) =>
    sprint.addTasks(sprintId, taskIds),
  /** SprintTasks leave the Sprint: all of them or none. */
  removeSprintTasks: ({
    sprintId,
    sprintTaskIds,
  }: OnSprint & { readonly sprintTaskIds: readonly SprintTaskId[] }) =>
    sprint.removeTasks(sprintId, sprintTaskIds),
  /** Planning で追加: a new Task, chosen at once. */
  createAndChooseTask: ({ sprintId, title, areaId }: OnSprint & NewTask) =>
    planning.addAndChoose(sprintId, title, areaId),
  setGoalLink: ({
    sprintId,
    sprintTaskId,
    goalLink,
  }: OnSprint & {
    readonly sprintTaskId: SprintTaskId;
    readonly goalLink: GoalLink;
  }) => planning.setLink(sprintId, sprintTaskId, goalLink),
  excludeAllOccurrences: ({
    sprintId,
    sprintTaskId,
  }: OnSprint & { readonly sprintTaskId: SprintTaskId }) =>
    planning.excludeAllOccurrences(sprintId, sprintTaskId),
  setOccurrenceIncluded: ({
    sprintId,
    occurrenceId,
    included,
  }: OnSprint & {
    readonly occurrenceId: OccurrenceId;
    readonly included: boolean;
  }) => planning.setOccurrenceIncluded(sprintId, occurrenceId, included),
  includeOccurrences: ({
    sprintId,
    occurrenceIds,
  }: OnSprint & { readonly occurrenceIds: readonly OccurrenceId[] }) =>
    planning.includeOccurrences(sprintId, occurrenceIds),

  // ---------------------------------------------------------------- Today
  chooseForToday: ({
    sprintId,
    date,
    sprintTaskId,
    occurrenceId,
  }: ForToday & {
    readonly sprintTaskId: SprintTaskId;
    readonly occurrenceId?: OccurrenceId;
  }) => today.choose(sprintId, date, sprintTaskId, occurrenceId),
  /** 今日へ for a Task outside the running Sprint. */
  addTaskToToday: ({ sprintId, date, taskId }: ForToday & OnTask) =>
    task.toToday(sprintId, date, taskId),
  /** Today's quick add: a new Task, in the Sprint and chosen for today. */
  createTaskForToday: ({ sprintId, date, title, areaId }: ForToday & NewTask) =>
    today.addAndChoose(sprintId, date, title, areaId),
  startSelection: ({ sprintId, selectionId }: OnSelection) =>
    today.start(sprintId, selectionId),
  pauseSelection: ({
    sprintId,
    selectionId,
    hours,
  }: OnSelection & { readonly hours?: number }) =>
    today.pause(sprintId, selectionId, hours),
  deferSelection: ({ sprintId, selectionId }: OnSelection) =>
    today.defer(sprintId, selectionId),
  /** Takes back 見送り, today only. */
  undoDeferSelection: ({ sprintId, selectionId }: OnSelection) =>
    today.undoDefer(sprintId, selectionId),
  removeFromToday: ({ sprintId, selectionId }: OnSelection) =>
    today.remove(sprintId, selectionId),
  /** Takes back 今週の残りに戻す, today only. */
  undoRemoveFromToday: ({ sprintId, selectionId }: OnSelection) =>
    today.undoRemove(sprintId, selectionId),
  completeSelection: ({ sprintId, selectionId }: OnSelection) =>
    today.complete(sprintId, selectionId),
  /** Today's, or a past day's (#53). */
  undoCompleteSelection: ({ sprintId, selectionId }: OnSelection) =>
    running.undoCompletion(sprintId, selectionId),
  skipSelection: ({ sprintId, selectionId }: OnSelection) =>
    today.skip(sprintId, selectionId),
  /** Today's, or a past day's (#53). */
  undoSkipSelection: ({ sprintId, selectionId }: OnSelection) =>
    running.undoSkipping(sprintId, selectionId),
  /** Actual hours, while the Sprint runs or in its Review (F22). */
  recordActualTime: ({
    sprintId,
    sprintTaskId,
    date,
    hours,
    occurrenceId,
  }: OnSprint & {
    readonly sprintTaskId: SprintTaskId;
    readonly date: LocalDate;
    readonly hours: number;
    readonly occurrenceId?: OccurrenceId;
  }) => sprint.recordActual(sprintId, sprintTaskId, date, hours, occurrenceId),
  noteInterrupt: ({ sprintId, text, minutes }: OnSprint & InterruptText) =>
    today.interrupt(sprintId, text, minutes),
  editInterrupt: ({
    sprintId,
    interruptNoteId,
    text,
    minutes,
  }: OnInterrupt & InterruptText) =>
    today.editNote(sprintId, interruptNoteId, text, minutes),
  deleteInterrupt: ({ sprintId, interruptNoteId }: OnInterrupt) =>
    today.deleteNote(sprintId, interruptNoteId),
  restoreInterrupt: ({
    sprintId,
    note,
  }: OnSprint & { readonly note: InterruptNote }) =>
    today.restoreNote(sprintId, note),

  // ---------------------------------------------------------------- Retro
  /** Retro を始める, from the last day (F21). */
  beginRetro: ({ sprintId }: OnSprint) => today.beginRetro(sprintId),
  assessGoal: ({
    sprintId,
    areaId,
    assessment,
  }: OnSprint & {
    readonly areaId: AreaId;
    readonly assessment: SelfAssessment | null;
  }) => retro.assess(sprintId, areaId, assessment),
  pinFact: ({ sprintId, pin }: OnSprint & { readonly pin: RetroPin }) =>
    retro.pin(sprintId, pin),
  unpinFact: ({ sprintId, pin }: OnSprint & { readonly pin: RetroPin }) =>
    retro.unpin(sprintId, pin),
  setReflection: ({ sprintId, text }: OnSprint & { readonly text: string }) =>
    retro.reflect(sprintId, text),
  setImprovement: ({ sprintId, text }: OnSprint & { readonly text: string }) =>
    retro.improve(sprintId, text),
  decideCriterion: ({
    sprintId,
    decision,
  }: OnSprint & { readonly decision: RetroDecision }) =>
    retro.decide(sprintId, decision),
  completeRetro: ({ sprintId }: OnSprint) => retro.complete(sprintId),

  // -------------------------------------------------- Planning criteria
  /** 基準にもする: a draft from the improvement of the Sprint in Review. */
  draftCriterion: ({
    sprintId,
    policy,
  }: OnSprint & { readonly policy: CriterionPolicy }) =>
    retro.draft(sprintId, policy),
  setDraftPolicy: ({
    criterionId,
    policy,
  }: OnCriterion & { readonly policy: CriterionPolicy }) =>
    retro.setDraft(criterionId, policy),
  dropCriterionDraft: ({ criterionId }: OnCriterion) =>
    retro.dropDraft(criterionId),
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
