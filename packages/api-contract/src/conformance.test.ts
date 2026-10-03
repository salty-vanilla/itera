// The contract and packages/application agree (#265 完了条件): every
// operation and read of the application has its operation in the contract,
// and their inputs, outputs and results are the contract's types. Checked
// by `pnpm typecheck` (tsconfig.test.json); the `it`s only list them.
import type {
  AppOverview,
  BacklogData,
  Clock,
  DayData,
  EditableArea,
  NextPlanning,
  OperationInput,
  OperationName,
  OperationOutput,
  PlanningData,
  RetroData,
  RunningData,
  SprintChoice,
  TodayData,
} from '@itera/application';
import type { BacklogSlice } from '@itera/domain';
import { describe, expectTypeOf, it } from 'vitest';
import type * as Gen from './index';
import type { Equal, Plain, WithNull } from './testing';

/** Each operation's request body and response, as generated. */
type ContractOperations = {
  createArea: [Gen.CreateAreaData['body'], Gen.CreateAreaResponse];
  renameArea: [Gen.RenameAreaData['body'], Gen.RenameAreaResponse];
  archiveArea: [Gen.ArchiveAreaData['body'], Gen.ArchiveAreaResponse];
  restoreArea: [Gen.RestoreAreaData['body'], Gen.RestoreAreaResponse];
  chooseTasks: [Gen.ChooseTasksData['body'], Gen.ChooseTasksResponse];
  unchooseTasks: [Gen.UnchooseTasksData['body'], Gen.UnchooseTasksResponse];
  unchooseTasksByTask: [
    Gen.UnchooseTasksByTaskData['body'],
    Gen.UnchooseTasksByTaskResponse,
  ];
  setOccurrenceIncluded: [
    Gen.SetOccurrenceIncludedData['body'],
    Gen.SetOccurrenceIncludedResponse,
  ];
  includeOccurrences: [
    Gen.IncludeOccurrencesData['body'],
    Gen.IncludeOccurrencesResponse,
  ];
  excludeAllOccurrences: [
    Gen.ExcludeAllOccurrencesData['body'],
    Gen.ExcludeAllOccurrencesResponse,
  ];
  createAndChooseTask: [
    Gen.CreateAndChooseTaskData['body'],
    Gen.CreateAndChooseTaskResponse,
  ];
  setPlanningGoal: [
    Gen.SetPlanningGoalData['body'],
    Gen.SetPlanningGoalResponse,
  ];
  setGoalLink: [Gen.SetGoalLinkData['body'], Gen.SetGoalLinkResponse];
  setPlanningAvailableHours: [
    Gen.SetPlanningAvailableHoursData['body'],
    Gen.SetPlanningAvailableHoursResponse,
  ];
  confirmSprint: [Gen.ConfirmSprintData['body'], Gen.ConfirmSprintResponse];
  createTask: [Gen.CreateTaskData['body'], Gen.CreateTaskResponse];
  saveTask: [Gen.SaveTaskData['body'], Gen.SaveTaskResponse];
  adoptSuggestion: [
    Gen.AdoptSuggestionData['body'],
    Gen.AdoptSuggestionResponse,
  ];
  undoAdoption: [Gen.UndoAdoptionData['body'], Gen.UndoAdoptionResponse];
  adoptEditedSuggestion: [
    Gen.AdoptEditedSuggestionData['body'],
    Gen.AdoptEditedSuggestionResponse,
  ];
  rejectSuggestion: [
    Gen.RejectSuggestionData['body'],
    Gen.RejectSuggestionResponse,
  ];
  undoRejection: [Gen.UndoRejectionData['body'], Gen.UndoRejectionResponse];
  addSubtask: [Gen.AddSubtaskData['body'], Gen.AddSubtaskResponse];
  setSubtaskDone: [Gen.SetSubtaskDoneData['body'], Gen.SetSubtaskDoneResponse];
  setSubtaskEstimate: [
    Gen.SetSubtaskEstimateData['body'],
    Gen.SetSubtaskEstimateResponse,
  ];
  archiveTask: [Gen.ArchiveTaskData['body'], Gen.ArchiveTaskResponse];
  restoreTask: [Gen.RestoreTaskData['body'], Gen.RestoreTaskResponse];
  completeTask: [Gen.CompleteTaskData['body'], Gen.CompleteTaskResponse];
  undoCompleteTask: [
    Gen.UndoCompleteTaskData['body'],
    Gen.UndoCompleteTaskResponse,
  ];
  addTaskToToday: [Gen.AddTaskToTodayData['body'], Gen.AddTaskToTodayResponse];
  addTaskToWeek: [Gen.AddTaskToWeekData['body'], Gen.AddTaskToWeekResponse];
  undoAddTaskToWeek: [
    Gen.UndoAddTaskToWeekData['body'],
    Gen.UndoAddTaskToWeekResponse,
  ];
  setRecurrence: [Gen.SetRecurrenceData['body'], Gen.SetRecurrenceResponse];
  endRecurrence: [Gen.EndRecurrenceData['body'], Gen.EndRecurrenceResponse];
  chooseForToday: [Gen.ChooseForTodayData['body'], Gen.ChooseForTodayResponse];
  startSelection: [Gen.StartSelectionData['body'], Gen.StartSelectionResponse];
  deferSelection: [Gen.DeferSelectionData['body'], Gen.DeferSelectionResponse];
  removeFromToday: [
    Gen.RemoveFromTodayData['body'],
    Gen.RemoveFromTodayResponse,
  ];
  undoCloseSelection: [
    Gen.UndoCloseSelectionData['body'],
    Gen.UndoCloseSelectionResponse,
  ];
  pauseSelection: [Gen.PauseSelectionData['body'], Gen.PauseSelectionResponse];
  completeSelection: [
    Gen.CompleteSelectionData['body'],
    Gen.CompleteSelectionResponse,
  ];
  undoCompleteSelection: [
    Gen.UndoCompleteSelectionData['body'],
    Gen.UndoCompleteSelectionResponse,
  ];
  skipSelection: [Gen.SkipSelectionData['body'], Gen.SkipSelectionResponse];
  undoSkipSelection: [
    Gen.UndoSkipSelectionData['body'],
    Gen.UndoSkipSelectionResponse,
  ];
  recordSelectionActual: [
    Gen.RecordSelectionActualData['body'],
    Gen.RecordSelectionActualResponse,
  ];
  noteInterrupt: [Gen.NoteInterruptData['body'], Gen.NoteInterruptResponse];
  editInterrupt: [Gen.EditInterruptData['body'], Gen.EditInterruptResponse];
  deleteInterrupt: [
    Gen.DeleteInterruptData['body'],
    Gen.DeleteInterruptResponse,
  ];
  restoreInterrupt: [
    Gen.RestoreInterruptData['body'],
    Gen.RestoreInterruptResponse,
  ];
  createTaskForToday: [
    Gen.CreateTaskForTodayData['body'],
    Gen.CreateTaskForTodayResponse,
  ];
  beginRetro: [Gen.BeginRetroData['body'], Gen.BeginRetroResponse];
  setRunningGoal: [Gen.SetRunningGoalData['body'], Gen.SetRunningGoalResponse];
  setRunningAvailableHours: [
    Gen.SetRunningAvailableHoursData['body'],
    Gen.SetRunningAvailableHoursResponse,
  ];
  undoPastDay: [Gen.UndoPastDayData['body'], Gen.UndoPastDayResponse];
  assessGoal: [Gen.AssessGoalData['body'], Gen.AssessGoalResponse];
  togglePin: [Gen.TogglePinData['body'], Gen.TogglePinResponse];
  setReflection: [Gen.SetReflectionData['body'], Gen.SetReflectionResponse];
  setImprovement: [Gen.SetImprovementData['body'], Gen.SetImprovementResponse];
  draftCriterion: [Gen.DraftCriterionData['body'], Gen.DraftCriterionResponse];
  setDraftPolicy: [Gen.SetDraftPolicyData['body'], Gen.SetDraftPolicyResponse];
  dropCriterionDraft: [
    Gen.DropCriterionDraftData['body'],
    Gen.DropCriterionDraftResponse,
  ];
  decideCriterion: [
    Gen.DecideCriterionData['body'],
    Gen.DecideCriterionResponse,
  ];
  recordReviewActual: [
    Gen.RecordReviewActualData['body'],
    Gen.RecordReviewActualResponse,
  ];
  completeRetro: [Gen.CompleteRetroData['body'], Gen.CompleteRetroResponse];
  beginPlanning: [Gen.BeginPlanningData['body'], Gen.BeginPlanningResponse];
};

/** Each read's result in packages/application, and the response's `view`. */
type ContractReads = {
  getOverview: [AppOverview, Gen.GetOverviewResponse];
  listAreas: [readonly EditableArea[], Gen.ListAreasResponse];
  getBacklog: [BacklogData, Gen.GetBacklogResponse];
  getSprintChoice: [SprintChoice | undefined, Gen.GetSprintChoiceResponse];
  getPlanning: [PlanningData | undefined, Gen.GetPlanningResponse];
  getRunning: [RunningData | undefined, Gen.GetRunningResponse];
  getToday: [TodayData | undefined, Gen.GetTodayResponse];
  getDay: [DayData | undefined, Gen.GetDayResponse];
  getRetro: [RetroData | undefined, Gen.GetRetroResponse];
  getNextPlanning: [NextPlanning, Gen.GetNextPlanningResponse];
};

/** The operations whose input differs from the contract's request body. */
type InputMismatch = {
  [N in OperationName]: Equal<
    Plain<OperationInput<N>>,
    Plain<ContractOperations[N][0]>
  > extends true
    ? never
    : N;
}[OperationName];

/** The operations whose output differs from the contract's response. */
type OutputMismatch = {
  [N in OperationName]: Equal<
    Plain<OperationOutput<N>>,
    Plain<ContractOperations[N][1]>
  > extends true
    ? never
    : N;
}[OperationName];

/** The reads whose result differs from the response's `view`. */
type ReadMismatch = {
  [N in keyof ContractReads]: Equal<
    Plain<WithNull<ContractReads[N][0]>>,
    Plain<ContractReads[N][1]['view']>
  > extends true
    ? never
    : N;
}[keyof ContractReads];

/** The reads whose `clock` is not the application's Clock. */
type ClockMismatch = {
  [N in keyof ContractReads]: Equal<
    Plain<Clock>,
    Plain<ContractReads[N][1]['clock']>
  > extends true
    ? never
    : N;
}[keyof ContractReads];

describe('the contract and packages/application', () => {
  it('lists every operation, and nothing else', () => {
    expectTypeOf<keyof ContractOperations>().toEqualTypeOf<OperationName>();
  });

  it("takes each operation's input as its request body", () => {
    expectTypeOf<InputMismatch>().toEqualTypeOf<never>();
  });

  it("returns each operation's output as its response", () => {
    expectTypeOf<OutputMismatch>().toEqualTypeOf<never>();
  });

  it("returns each read's result as the response's view, null for none", () => {
    expectTypeOf<ReadMismatch>().toEqualTypeOf<never>();
    expectTypeOf<ClockMismatch>().toEqualTypeOf<never>();
  });

  it("takes the Backlog's filter as the read's query", () => {
    expectTypeOf<
      Plain<NonNullable<Gen.GetBacklogData['query']>>
    >().toEqualTypeOf<{ view?: BacklogSlice; area?: string }>();
  });
});
