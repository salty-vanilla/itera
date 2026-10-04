// The reads of the contract's resources, one name each (its operationId),
// with their input and what they return (#350): the API and the browser
// mock run them by name, as they run the operations, so that what a read
// calls and when it answers 404 are written once. `getMe` is not here: the
// person and their settings are the server's, and the Sprints they have now
// are `currentSprints` (ADR 0006「利用者」).
import type { LocalDate, Result, SprintId } from '@itera/domain';
import { areaList } from './area-view';
import { backlogData, type BacklogFilter } from './backlog-view';
import type { Clock } from './records';
import {
  dayView,
  sprintCandidates,
  sprintList,
  sprintRetro,
  sprintView,
} from './resource-views';
import { sprintIn } from './sprint-of';
import type { TaggedRecords } from './versions';

const ANY_STATE = ['planning', 'active', 'review', 'closed'] as const;

function found<T>(value: T): Result<T> {
  return { ok: true, value };
}

/**
 * A read of the person's Sprint with this ID: `notFound` (404) when the
 * person has none with it, as an operation on it answers (#295).
 */
function ofSprint<T>(
  records: TaggedRecords,
  sprintId: SprintId,
  read: (sprintId: SprintId) => T,
): Result<T> {
  const sprint = sprintIn(records, sprintId, ANY_STATE);
  return sprint.ok ? found(read(sprint.value.id)) : sprint;
}

/** Each read of the contract but `getMe`, by its operationId. */
export const reads = {
  listAreas: (records: TaggedRecords) => found(areaList(records)),
  getBacklog: (records: TaggedRecords, clock: Clock, filter: BacklogFilter) =>
    found(backlogData(records, clock, filter)),
  listSprints: (
    records: TaggedRecords,
    clock: Clock,
    filter: { readonly number?: number },
  ) => found(sprintList(records, clock, filter)),
  getSprint: (
    records: TaggedRecords,
    clock: Clock,
    input: { readonly sprintId: SprintId; readonly applyCriterion: boolean },
  ) =>
    ofSprint(records, input.sprintId, (sprintId) =>
      sprintView(records, clock, sprintId, {
        applyCriterion: input.applyCriterion,
      }),
    ),
  listSprintCandidates: (
    records: TaggedRecords,
    clock: Clock,
    input: { readonly sprintId: SprintId },
  ) =>
    ofSprint(records, input.sprintId, (sprintId) =>
      sprintCandidates(records, clock, sprintId),
    ),
  getSprintRetro: (
    records: TaggedRecords,
    clock: Clock,
    input: { readonly sprintId: SprintId },
  ) =>
    ofSprint(records, input.sprintId, (sprintId) =>
      sprintRetro(records, clock, sprintId),
    ),
  getDay: (
    records: TaggedRecords,
    clock: Clock,
    input: { readonly date: LocalDate },
  ) => found(dayView(records, clock, input.date)),
};

export type Reads = typeof reads;
export type ReadName = keyof Reads;
export type ReadInput<Name extends ReadName> = Parameters<Reads[Name]>[2];
export type ReadView<Name extends ReadName> =
  ReturnType<Reads[Name]> extends Result<infer T> ? T : never;

/** A read and its input. */
export type ReadCall = {
  [N in ReadName]: { readonly name: N; readonly input: ReadInput<N> };
}[ReadName];

/**
 * The read's result, `undefined` when there is nothing to show (the
 * response's `null`), or the domain's error (404 for a Sprint the person
 * does not have).
 */
export function runRead(
  call: ReadCall,
  records: TaggedRecords,
  clock: Clock,
): Result<unknown> {
  const read = reads[call.name] as (
    records: TaggedRecords,
    clock: Clock,
    input: unknown,
  ) => Result<unknown>;
  return read(records, clock, call.input);
}
