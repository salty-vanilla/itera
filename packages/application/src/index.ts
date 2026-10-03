// The application layer (ADR 0005): the person's operations and the values
// derived from the records, shared by the API and the browser mock. The
// rules are `@itera/domain`'s; this package reads the records, runs the
// domain's commands and says what to write. Only what they use is
// exported; the helpers stay inside.

// The person's operations, and the system's own records.
export {
  operations,
  type OperationInput,
  type OperationName,
  type OperationOutput,
  type Operations,
} from './operations';
export { reviewEnded } from './system-changes';
export { beginDay } from './today-changes';

// Running them over the records.
export {
  createMemoryStore,
  type Change,
  type ChangeContext,
  type Changed,
  type MemoryStoreOptions,
  type RecordStore,
  type StoreSnapshot,
} from './record-store';
export { mergeChanges } from './changes';
export { applyRecordChanges } from './records';
export type {
  Clock,
  RecordChanges,
  Records,
  RecordsWithActivity,
} from './records';

// IDs (ADR 0004 ID の形式).
export {
  createIdSource,
  parseId,
  type IdSource,
  type RandomBytes,
} from './ids';

// The reads: the API's responses.
export {
  backlogData,
  type BacklogData,
  type BacklogFilter,
  type BacklogItem,
} from './backlog-view';
export {
  dayData,
  type DayArea,
  type DayData,
  type DayRecord,
} from './day-view';
export {
  appOverview,
  areaList,
  type AppOverview,
  type EditableArea,
  type SprintSummary,
} from './overview-view';
export {
  planningData,
  type AreaPlan,
  type CandidateRow,
  type PlannedTask,
  type PlanningArea,
  type PlanningData,
  type RecurringCandidate,
} from './planning-view';
export {
  nextPlanningOf,
  retroData,
  type ActualTarget,
  type NextPlanning,
  type RetroArea,
  type RetroBlocker,
  type RetroCriterion,
  type RetroData,
  type RetroOccurrence,
} from './retro-view';
export {
  runningData,
  type PastDay,
  type PastDayRecord,
  type RunningArea,
  type RunningAreaPlan,
  type RunningData,
  type RunningTask,
} from './running-view';
export {
  sprintChoice,
  type SprintChoice,
  type SprintRef,
  type SprintWeek,
} from './sprint-choice';
export {
  todayData,
  type ClosedResolution,
  type ListedResolution,
  type TodayArea,
  type TodayData,
  type TodayItem,
  type TodayRow,
} from './today-view';
