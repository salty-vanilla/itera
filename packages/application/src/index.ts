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
export { catchUp } from './system-changes';
export { settingsChange, type SettingsInput } from './user-changes';

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

// The versions of the records and the conditions of the writes that
// replace their values (#321, ADR 0006 記録ごとの版).
export {
  etagOf,
  nextVersions,
  tagRecords,
  versionKey,
  type RecordVersions,
  type Tagged,
  type TaggedCriterion,
  type TaggedRecords,
  type TaggedRule,
  type TaggedSprint,
  type TaggedTask,
} from './versions';
export {
  checkCondition,
  currentCondition,
  etagAfter,
  isConditional,
  type Condition,
  type ConditionalOperation,
} from './conditions';

// IDs (ADR 0004 ID の形式).
export {
  createIdSource,
  parseId,
  type IdSource,
  type RandomBytes,
} from './ids';

// The reads of the contract's resources (#295): the API's responses.
export {
  currentSprints,
  dayView,
  sprintCandidates,
  sprintList,
  sprintRetro,
  sprintView,
  type CurrentSprints,
  type DayView,
  type SprintItem,
  type SprintView,
} from './resource-views';

// The reads the contract returns, and the types of their parts, which the
// contract takes (ADR 0007 依存の向き). The functions that make the parts
// stay in the package: `resource-views` puts them together.
export {
  backlogData,
  type BacklogData,
  type BacklogFilter,
  type BacklogItem,
} from './backlog-view';
export { type DayArea, type DayData, type DayRecord } from './day-view';
export {
  type DailySelectionCapabilities,
  type InterruptItem,
  type InterruptNoteCapabilities,
} from './capabilities';
export { areaList, type EditableArea } from './area-view';
export {
  type AreaPlan,
  type CandidateRow,
  type PlannedTask,
  type PlanningArea,
  type RecurringCandidate,
} from './planning-view';
export {
  type ActualTarget,
  type RetroArea,
  type RetroBlocker,
  type RetroCriterion,
  type RetroData,
  type RetroOccurrence,
} from './retro-view';
export {
  type PastDay,
  type PastDayRecord,
  type RunningArea,
  type RunningAreaPlan,
  type RunningData,
  type RunningTask,
} from './running-view';
export { type SprintWeek } from './sprint-choice';
export {
  type ClosedResolution,
  type ListedResolution,
  type TodayArea,
  type TodayData,
  type TodayItem,
  type TodayRow,
} from './today-view';
