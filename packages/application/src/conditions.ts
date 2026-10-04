// Which operations replace a record's values, and whether a write of one
// was made from the record as it is now (#321, ADR 0006 記録ごとの版). The
// API and the memory store check a write's condition (`If-Match`,
// `If-None-Match`) with these before the operation runs.
import type { Sprint, SprintId } from '@itera/domain';
import type { OperationInput, OperationName } from './operations';
import type { Records } from './records';
import { etagOf, versionKey, versionOf, type RecordVersions } from './versions';

/**
 * What a write says it was made from (RFC 9110 §13.1.1, §13.1.2): one of
 * the record's etags it read (`ifMatch`, `'*'` for any), or that it read
 * none (`ifNoneMatch: '*'`, for an operation that makes the record when
 * there is none). Both are checked when both are sent.
 */
export type Condition = {
  readonly ifMatch?: readonly string[] | '*';
  readonly ifNoneMatch?: '*';
};

/** The record a conditional write replaces, and whether there is one now. */
type Target = { readonly key: string; readonly exists: boolean };

/**
 * The record each operation that replaces values is on, from its input:
 * `undefined` when what it names is not there (the operation itself answers
 * that it is not found). Only a Goal can be missing while its Sprint is
 * there: writing one makes it.
 */
type TargetOf<N extends OperationName> = (
  input: OperationInput<N>,
  records: Records,
) => Target | undefined;

const sprintOf = (records: Records, sprintId: SprintId) =>
  records.sprints.find((s) => s.id === sprintId);

/** A part of a Sprint that is there or not, keyed when it is. */
const partOf = (
  sprint: Sprint | undefined,
  key: string,
  found: (sprint: Sprint) => boolean,
): Target | undefined =>
  sprint !== undefined && found(sprint) ? { key, exists: true } : undefined;

const conditionTargets: {
  readonly [N in ConditionalOperation]: TargetOf<N>;
} = {
  renameArea: ({ areaId }, records) =>
    records.areas.some((a) => a.id === areaId)
      ? { key: versionKey.area(areaId), exists: true }
      : undefined,
  saveTask: ({ taskId }, records) =>
    records.tasks.some((t) => t.id === taskId)
      ? { key: versionKey.task(taskId), exists: true }
      : undefined,
  setSubtaskDone: ({ taskId, subtaskId }, records) =>
    subtaskTarget(records, taskId, subtaskId),
  setSubtaskEstimate: ({ taskId, subtaskId }, records) =>
    subtaskTarget(records, taskId, subtaskId),
  setAvailableHours: ({ sprintId }, records) =>
    partOf(
      sprintOf(records, sprintId),
      versionKey.sprint(sprintId),
      () => true,
    ),
  setGoal: ({ sprintId, areaId }, records) =>
    goalTarget(records, sprintId, areaId),
  assessGoal: ({ sprintId, areaId }, records) =>
    goalTarget(records, sprintId, areaId),
  setGoalLink: ({ sprintId, sprintTaskId }, records) =>
    partOf(
      sprintOf(records, sprintId),
      versionKey.sprintTask(sprintTaskId),
      (s) => s.tasks.some((t) => t.id === sprintTaskId),
    ),
  editInterrupt: ({ sprintId, interruptNoteId }, records) =>
    partOf(
      sprintOf(records, sprintId),
      versionKey.interrupt(interruptNoteId),
      (s) => s.interrupts.some((n) => n.id === interruptNoteId),
    ),
  setReflection: ({ sprintId }, records) =>
    partOf(
      sprintOf(records, sprintId),
      versionKey.retro(sprintId),
      (s) => s.retro !== undefined,
    ),
  setImprovement: ({ sprintId }, records) =>
    partOf(
      sprintOf(records, sprintId),
      versionKey.retro(sprintId),
      (s) => s.retro !== undefined,
    ),
  decideCriterion: ({ sprintId }, records) =>
    partOf(
      sprintOf(records, sprintId),
      versionKey.criterionUse(sprintId),
      (s) => s.criterionUse !== undefined,
    ),
  setDraftPolicy: ({ criterionId }, records) =>
    records.criteria.some((c) => c.id === criterionId)
      ? { key: versionKey.criterion(criterionId), exists: true }
      : undefined,
};

function subtaskTarget(
  records: Records,
  taskId: OperationInput<'setSubtaskDone'>['taskId'],
  subtaskId: OperationInput<'setSubtaskDone'>['subtaskId'],
): Target | undefined {
  const task = records.tasks.find((t) => t.id === taskId);
  return task?.subtasks.some((s) => s.id === subtaskId)
    ? { key: versionKey.subtask(subtaskId), exists: true }
    : undefined;
}

function goalTarget(
  records: Records,
  sprintId: SprintId,
  areaId: OperationInput<'setGoal'>['areaId'],
): Target | undefined {
  const sprint = sprintOf(records, sprintId);
  if (sprint === undefined) return undefined;
  return {
    key: versionKey.goal(sprintId, areaId),
    exists: sprint.goals.some((g) => g.areaId === areaId),
  };
}

/**
 * The operations that replace a record's values (the contract's PATCH
 * surfaces): a write of one names the version it was made from. State
 * transitions are not among them: the domain decides those from the
 * record's state now, so another change to the record does not matter.
 */
export type ConditionalOperation =
  | 'renameArea'
  | 'saveTask'
  | 'setSubtaskDone'
  | 'setSubtaskEstimate'
  | 'setAvailableHours'
  | 'setGoal'
  | 'assessGoal'
  | 'setGoalLink'
  | 'editInterrupt'
  | 'setReflection'
  | 'setImprovement'
  | 'decideCriterion'
  | 'setDraftPolicy';

export const conditionalOperations: readonly ConditionalOperation[] =
  Object.keys(conditionTargets) as ConditionalOperation[];

export function isConditional(
  name: OperationName,
): name is ConditionalOperation {
  return Object.hasOwn(conditionTargets, name);
}

/**
 * Whether a write may run on the records as loaded:
 *
 * - `met`: it was made from the record as it is (or needs no condition, or
 *   names a record that is not there, which the operation answers);
 * - `failed`: the record has changed since (or was made, or is gone);
 * - `required`: a write that replaces values came without a condition.
 */
export function checkCondition<N extends OperationName>(
  name: N,
  input: OperationInput<N>,
  records: Records,
  versions: RecordVersions,
  condition: Condition | undefined,
): 'met' | 'failed' | 'required' {
  if (!isConditional(name)) return 'met';
  const targetOf = conditionTargets[name] as TargetOf<ConditionalOperation>;
  const target = targetOf(input as never, records);
  if (target === undefined) return 'met';
  const { ifMatch, ifNoneMatch } = condition ?? {};
  if (ifMatch === undefined && ifNoneMatch === undefined) return 'required';
  if (ifMatch !== undefined) {
    if (!target.exists) return 'failed';
    const etag = etagOf(versionOf(versions, target.key));
    if (ifMatch !== '*' && !ifMatch.includes(etag)) return 'failed';
  }
  if (ifNoneMatch !== undefined && target.exists) return 'failed';
  return 'met';
}
