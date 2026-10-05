// The reads of the contract's resources, one name each (its operationId),
// with their input and what they return (#350): the API and the browser
// mock run them by name, as they run the operations, so that what a read
// calls and when it answers 404 are written once. `getMe` is not here: the
// person and their settings are the server's, and the Sprints they have now
// are `currentSprints` (ADR 0006「利用者」).
import {
  err,
  ok,
  type LocalDate,
  type Result,
  type SprintId,
} from '@itera/domain';
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
import type { TaggedRecords } from './versions';

/**
 * What a read of a Sprint the person does not have answers: `notFound`
 * (404), as an operation on it does (`sprintIn`, #295).
 */
function notFound(sprintId: SprintId): Result<never> {
  return err('notFound', `Sprint ${sprintId}`);
}

/** A read of the person's Sprint with this ID, or `notFound`. */
function ofSprint<T>(
  records: TaggedRecords,
  sprintId: SprintId,
  read: () => T,
): Result<T> {
  return records.sprints.some((s) => s.id === sprintId)
    ? ok(read())
    : notFound(sprintId);
}

/** Each read of the contract but `getMe`, by its operationId. */
export const reads = {
  listAreas: (records: TaggedRecords) => ok(areaList(records)),
  getBacklog: (records: TaggedRecords, clock: Clock, filter: BacklogFilter) =>
    ok(backlogData(records, clock, filter)),
  listSprints: (
    records: TaggedRecords,
    clock: Clock,
    filter: { readonly number?: number },
  ) => ok(sprintList(records, clock, filter)),
  getSprint: (
    records: TaggedRecords,
    clock: Clock,
    input: { readonly sprintId: SprintId; readonly applyCriterion: boolean },
  ) => {
    // `undefined` only for a Sprint the person does not have.
    const view = sprintView(records, clock, input.sprintId, {
      applyCriterion: input.applyCriterion,
    });
    return view === undefined ? notFound(input.sprintId) : ok(view);
  },
  listSprintCandidates: (
    records: TaggedRecords,
    clock: Clock,
    input: { readonly sprintId: SprintId },
  ) =>
    ofSprint(records, input.sprintId, () =>
      sprintCandidates(records, clock, input.sprintId),
    ),
  getSprintRetro: (
    records: TaggedRecords,
    clock: Clock,
    input: { readonly sprintId: SprintId },
  ) =>
    ofSprint(records, input.sprintId, () =>
      sprintRetro(records, clock, input.sprintId),
    ),
  getDay: (
    records: TaggedRecords,
    clock: Clock,
    input: { readonly date: LocalDate },
  ) => ok(dayView(records, clock, input.date)),
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
