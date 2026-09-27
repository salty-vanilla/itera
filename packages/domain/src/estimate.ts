import type { SuggestionBound } from './shared/activity';
import {
  applied,
  type CommandContext,
  type CommandResult,
} from './shared/command';
import type { EstimateSuggestionId } from './shared/ids';
import { omit } from './shared/record';
import { err } from './shared/result';
import type { Instant } from './shared/time';
import { isPositiveHours, type Task } from './task';

/**
 * The person's own point value, in hours. It only changes by the person's
 * hand: typing it, or adopting (採用) a suggestion (invariant 6).
 */
export interface Estimate {
  readonly hours: number;
  readonly setAt: Instant;
  readonly source: EstimateSource;
}

export type EstimateSource =
  | { readonly kind: 'manual' }
  | {
      readonly kind: 'adopted';
      readonly suggestionId: EstimateSuggestionId;
      readonly bound: SuggestionBound;
    };

export type SuggestionState = 'presented' | 'adopted' | 'rejected' | 'replaced';

/** The product's suggested range. Never becomes an Estimate by itself. */
export interface EstimateSuggestion {
  readonly id: EstimateSuggestionId;
  readonly lo: number;
  readonly hi: number;
  readonly rationale: string;
  readonly uncertainties: readonly string[];
  readonly createdAt: Instant;
  readonly state: SuggestionState;
}

/** The suggestion currently on show, if any. At most one is presented. */
export function presentedSuggestion(
  task: Task,
): EstimateSuggestion | undefined {
  return task.suggestions.find((s) => s.state === 'presented');
}

export function boundValue(
  range: { readonly lo: number; readonly hi: number },
  bound: SuggestionBound,
): number {
  switch (bound) {
    case 'lo':
      return range.lo;
    case 'mid':
      return (range.lo + range.hi) / 2;
    case 'hi':
      return range.hi;
  }
}

/** The person types an Estimate, or clears it with `null`. */
export function setEstimate(
  task: Task,
  hours: number | null,
  ctx: CommandContext,
): CommandResult<Task> {
  if (hours !== null && !isPositiveHours(hours)) {
    return err('invalidInput', 'Estimate must be positive hours.');
  }
  const from = task.estimate?.hours ?? null;
  const next: Task =
    hours === null
      ? omit(task, 'estimate')
      : {
          ...task,
          estimate: { hours, setAt: ctx.now, source: { kind: 'manual' } },
        };
  if (from === hours) return applied(task, []);
  return applied(next, [
    {
      kind: 'estimateChanged',
      at: ctx.now,
      actor: ctx.actor,
      taskId: task.id,
      from,
      to: hours,
    },
  ]);
}

export interface PresentSuggestionInput {
  readonly id: EstimateSuggestionId;
  readonly lo: number;
  readonly hi: number;
  readonly rationale: string;
  readonly uncertainties: readonly string[];
}

/**
 * Shows a new suggestion. A suggestion already on show becomes `replaced`.
 * The Estimate is untouched (invariant 6).
 */
export function presentSuggestion(
  task: Task,
  input: PresentSuggestionInput,
  ctx: CommandContext,
): CommandResult<Task> {
  if (!isPositiveHours(input.lo) || !isPositiveHours(input.hi)) {
    return err('invalidInput', 'Suggestion bounds must be positive hours.');
  }
  if (input.lo > input.hi) {
    return err('invalidInput', 'Suggestion lo must not exceed hi.');
  }
  if (task.suggestions.some((s) => s.id === input.id)) {
    return err('invalidInput', `Suggestion ${input.id} already exists.`);
  }
  const suggestion: EstimateSuggestion = {
    ...input,
    createdAt: ctx.now,
    state: 'presented',
  };
  const suggestions = [
    ...task.suggestions.map((s) =>
      s.state === 'presented' ? { ...s, state: 'replaced' as const } : s,
    ),
    suggestion,
  ];
  return applied({ ...task, suggestions }, [
    {
      kind: 'suggestionPresented',
      at: ctx.now,
      actor: ctx.actor,
      taskId: task.id,
      suggestionId: suggestion.id,
    },
  ]);
}

/**
 * 採用: the person makes one end of a presented suggestion their Estimate.
 * This is the only way a suggestion changes the Task, and the Estimate
 * records where it came from (invariant 6).
 */
export function adoptSuggestion(
  task: Task,
  suggestionId: EstimateSuggestionId,
  bound: SuggestionBound,
  ctx: CommandContext,
): CommandResult<Task> {
  const suggestion = task.suggestions.find((s) => s.id === suggestionId);
  if (suggestion === undefined) {
    return err('notFound', `Suggestion ${suggestionId} not found.`);
  }
  if (suggestion.state !== 'presented') {
    return err(
      'invalidTransition',
      `Cannot adopt a ${suggestion.state} suggestion.`,
    );
  }
  const hours = boundValue(suggestion, bound);
  const estimate: Estimate = {
    hours,
    setAt: ctx.now,
    source: { kind: 'adopted', suggestionId, bound },
  };
  const suggestions = task.suggestions.map((s) =>
    s.id === suggestionId ? { ...s, state: 'adopted' as const } : s,
  );
  return applied({ ...task, estimate, suggestions }, [
    {
      kind: 'estimateChanged',
      at: ctx.now,
      actor: ctx.actor,
      taskId: task.id,
      from: task.estimate?.hours ?? null,
      to: hours,
      adoptedFrom: { suggestionId, bound },
    },
  ]);
}

export function rejectSuggestion(
  task: Task,
  suggestionId: EstimateSuggestionId,
  ctx: CommandContext,
): CommandResult<Task> {
  const suggestion = task.suggestions.find((s) => s.id === suggestionId);
  if (suggestion === undefined) {
    return err('notFound', `Suggestion ${suggestionId} not found.`);
  }
  if (suggestion.state !== 'presented') {
    return err(
      'invalidTransition',
      `Cannot reject a ${suggestion.state} suggestion.`,
    );
  }
  const suggestions = task.suggestions.map((s) =>
    s.id === suggestionId ? { ...s, state: 'rejected' as const } : s,
  );
  return applied({ ...task, suggestions }, [
    {
      kind: 'suggestionRejected',
      at: ctx.now,
      actor: ctx.actor,
      taskId: task.id,
      suggestionId,
    },
  ]);
}
