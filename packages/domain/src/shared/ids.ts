declare const idBrand: unique symbol;

/**
 * IDs are created outside the domain (UI, API or fixtures) and passed in, so
 * the domain never depends on randomness. The brand keeps one kind of ID
 * from being passed where another is expected.
 */
export type Id<Kind extends string> = string & {
  readonly [idBrand]: Kind;
};

export type UserId = Id<'User'>;
export type AreaId = Id<'Area'>;
export type TaskId = Id<'Task'>;
export type SubtaskId = Id<'Subtask'>;
export type EstimateSuggestionId = Id<'EstimateSuggestion'>;
export type RecurrenceRuleId = Id<'RecurrenceRule'>;
export type OccurrenceId = Id<'Occurrence'>;
export type SprintId = Id<'Sprint'>;
export type SprintTaskId = Id<'SprintTask'>;
export type PlanningCriterionId = Id<'PlanningCriterion'>;
export type DailySelectionId = Id<'DailySelection'>;
export type InterruptNoteId = Id<'InterruptNote'>;

/** Brands a string as an ID. Use at the boundary (fixtures, API, UI). */
export function id<Kind extends string>(value: string): Id<Kind> {
  return value as Id<Kind>;
}
