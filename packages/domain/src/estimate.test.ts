import { describe, expect, it } from 'vitest';
import {
  adoptEditedSuggestion,
  adoptSuggestion,
  presentSuggestion,
  rejectSuggestion,
  setEstimate,
  undoAdoption,
  undoRejection,
} from './estimate';
import { planningValueOf } from './planning-value';
import { id } from './shared/ids';
import { at, newTask, unwrap } from './testing';

const sug = id<'EstimateSuggestion'>('sug-1');

function withSuggestion() {
  return unwrap(
    presentSuggestion(
      newTask(),
      { id: sug, lo: 2, hi: 4, rationale: '', uncertainties: [] },
      at('2026-09-28T00:00:00.000Z'),
    ),
  );
}

describe('undoAdoption (F27)', () => {
  it('clears an Estimate that did not exist and shows the suggestion again', () => {
    const before = withSuggestion();
    const adopted = unwrap(
      adoptSuggestion(before, sug, 'hi', at('2026-09-28T00:01:00.000Z')),
    );
    const result = undoAdoption(
      adopted,
      { suggestionId: sug, previous: before.estimate ?? null },
      at('2026-09-28T00:02:00.000Z'),
    );
    expect(result.ok && result.value.record).toEqual(before);
    expect(result.ok && result.value.activities).toMatchObject([
      { kind: 'estimateChanged', from: 4, to: null },
      { kind: 'suggestionAdoptionUndone', suggestionId: sug },
    ]);
  });

  it('restores the Estimate typed before the adoption', () => {
    const before = unwrap(
      setEstimate(withSuggestion(), 3, at('2026-09-28T00:01:00.000Z')),
    );
    const adopted = unwrap(
      adoptSuggestion(before, sug, 'lo', at('2026-09-28T00:02:00.000Z')),
    );
    const undone = unwrap(
      undoAdoption(
        adopted,
        { suggestionId: sug, previous: before.estimate ?? null },
        at('2026-09-28T00:03:00.000Z'),
      ),
    );
    expect(undone.estimate).toEqual(before.estimate);
    expect(undone.suggestions[0]?.state).toBe('presented');
  });

  it('refuses once the Estimate has changed since the adoption', () => {
    const adopted = unwrap(
      adoptSuggestion(
        withSuggestion(),
        sug,
        'mid',
        at('2026-09-28T00:01:00.000Z'),
      ),
    );
    const typed = unwrap(
      setEstimate(adopted, 5, at('2026-09-28T00:02:00.000Z')),
    );
    const result = undoAdoption(
      typed,
      { suggestionId: sug, previous: null },
      at('2026-09-28T00:03:00.000Z'),
    );
    expect(result.ok || result.error.code).toBe('invalidTransition');
  });

  it('refuses a suggestion that was not adopted', () => {
    const rejected = unwrap(
      rejectSuggestion(withSuggestion(), sug, at('2026-09-28T00:01:00.000Z')),
    );
    const result = undoAdoption(
      rejected,
      { suggestionId: sug, previous: null },
      at('2026-09-28T00:02:00.000Z'),
    );
    expect(result.ok || result.error.code).toBe('invalidTransition');
  });

  it('refuses while another suggestion is on show (at most one presented)', () => {
    const adopted = unwrap(
      adoptSuggestion(
        withSuggestion(),
        sug,
        'hi',
        at('2026-09-28T00:01:00.000Z'),
      ),
    );
    const again = unwrap(
      presentSuggestion(
        adopted,
        { id: id('sug-2'), lo: 1, hi: 2, rationale: '', uncertainties: [] },
        at('2026-09-28T00:02:00.000Z'),
      ),
    );
    const result = undoAdoption(
      again,
      { suggestionId: sug, previous: null },
      at('2026-09-28T00:03:00.000Z'),
    );
    expect(result.ok || result.error.code).toBe('invalidTransition');
  });
});

describe('adoptEditedSuggestion (F31)', () => {
  it('makes the person’s hours the Estimate and remembers the suggestion', () => {
    const result = adoptEditedSuggestion(
      withSuggestion(),
      { suggestionId: sug, hours: 2.5 },
      at('2026-09-28T00:01:00.000Z'),
    );
    const task = unwrap(result);
    expect(task.estimate).toMatchObject({
      hours: 2.5,
      source: { kind: 'edited', suggestionId: sug },
    });
    expect(task.suggestions[0]?.state).toBe('adopted');
    expect(result.ok && result.value.activities).toMatchObject([
      {
        kind: 'estimateChanged',
        from: null,
        to: 2.5,
        adoptedFrom: { suggestionId: sug },
      },
    ]);
    expect(result.ok && result.value.activities[0]).not.toHaveProperty(
      'adoptedFrom.bound',
    );
  });

  it('takes hours outside the range too: they are the person’s own', () => {
    const task = unwrap(
      adoptEditedSuggestion(
        withSuggestion(),
        { suggestionId: sug, hours: 6 },
        at('2026-09-28T00:01:00.000Z'),
      ),
    );
    expect(task.estimate?.hours).toBe(6);
  });

  it('refuses non-positive hours and a suggestion not on show', () => {
    expect(
      adoptEditedSuggestion(
        withSuggestion(),
        { suggestionId: sug, hours: 0 },
        at('2026-09-28T00:01:00.000Z'),
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
    const rejected = unwrap(
      rejectSuggestion(withSuggestion(), sug, at('2026-09-28T00:01:00.000Z')),
    );
    expect(
      adoptEditedSuggestion(
        rejected,
        { suggestionId: sug, hours: 2 },
        at('2026-09-28T00:02:00.000Z'),
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
  });

  it('F27 applies: it can be undone right after', () => {
    const before = withSuggestion();
    const edited = unwrap(
      adoptEditedSuggestion(
        before,
        { suggestionId: sug, hours: 2.5 },
        at('2026-09-28T00:01:00.000Z'),
      ),
    );
    const undone = unwrap(
      undoAdoption(
        edited,
        { suggestionId: sug, previous: null },
        at('2026-09-28T00:02:00.000Z'),
      ),
    );
    expect(undone).toEqual(before);
  });
});

describe('undoRejection (F30)', () => {
  it('puts a rejected suggestion on show again, Estimate untouched', () => {
    const before = unwrap(
      setEstimate(withSuggestion(), 3, at('2026-09-28T00:01:00.000Z')),
    );
    const rejected = unwrap(
      rejectSuggestion(before, sug, at('2026-09-28T00:02:00.000Z')),
    );
    const result = undoRejection(rejected, sug, at('2026-09-28T00:03:00.000Z'));
    expect(unwrap(result)).toEqual(before);
    expect(result.ok && result.value.activities).toMatchObject([
      { kind: 'suggestionRejectionUndone', suggestionId: sug },
    ]);
  });

  it('refuses a suggestion that was not rejected', () => {
    expect(
      undoRejection(withSuggestion(), sug, at('2026-09-28T00:01:00.000Z')),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
  });

  it('refuses while another suggestion is on show (at most one presented)', () => {
    const rejected = unwrap(
      rejectSuggestion(withSuggestion(), sug, at('2026-09-28T00:01:00.000Z')),
    );
    const again = unwrap(
      presentSuggestion(
        rejected,
        { id: id('sug-2'), lo: 1, hi: 2, rationale: '', uncertainties: [] },
        at('2026-09-28T00:02:00.000Z'),
      ),
    );
    expect(
      undoRejection(again, sug, at('2026-09-28T00:03:00.000Z')),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
  });
});

describe('F30・F31 boundaries', () => {
  it('returns notFound for a suggestion the Task does not have', () => {
    const task = withSuggestion();
    const other = id<'EstimateSuggestion'>('sug-x');
    expect(
      adoptEditedSuggestion(
        task,
        { suggestionId: other, hours: 2 },
        at('2026-09-28T00:01:00.000Z'),
      ),
    ).toMatchObject({ ok: false, error: { code: 'notFound' } });
    expect(
      undoRejection(task, other, at('2026-09-28T00:01:00.000Z')),
    ).toMatchObject({ ok: false, error: { code: 'notFound' } });
  });

  it('F27: an edited adoption is no longer undone once the Estimate is typed over', () => {
    const edited = unwrap(
      adoptEditedSuggestion(
        withSuggestion(),
        { suggestionId: sug, hours: 2.5 },
        at('2026-09-28T00:01:00.000Z'),
      ),
    );
    const typed = unwrap(
      setEstimate(edited, 5, at('2026-09-28T00:02:00.000Z')),
    );
    expect(
      undoAdoption(
        typed,
        { suggestionId: sug, previous: null },
        at('2026-09-28T00:03:00.000Z'),
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
  });

  it('invariant 8: after undoing a rejection the suggestion is the planning value again', () => {
    const now = at('2026-09-28T00:03:00.000Z').now;
    const rejected = unwrap(
      rejectSuggestion(withSuggestion(), sug, at('2026-09-28T00:01:00.000Z')),
    );
    expect(planningValueOf(rejected, { now }).base).toBe('none');
    const back = unwrap(
      undoRejection(rejected, sug, at('2026-09-28T00:02:00.000Z')),
    );
    expect(planningValueOf(back, { now })).toMatchObject({
      base: 'suggestion',
      lo: 2,
      hi: 4,
    });
  });

  it('invariant 8: an edited adoption makes the Estimate the planning value', () => {
    const now = at('2026-09-28T00:03:00.000Z').now;
    const edited = unwrap(
      adoptEditedSuggestion(
        withSuggestion(),
        { suggestionId: sug, hours: 2.5 },
        at('2026-09-28T00:01:00.000Z'),
      ),
    );
    expect(planningValueOf(edited, { now })).toMatchObject({
      base: 'estimate',
      lo: 2.5,
      hi: 2.5,
    });
  });
});
