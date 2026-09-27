import { describe, expect, it } from 'vitest';
import {
  adoptSuggestion,
  presentSuggestion,
  rejectSuggestion,
  setEstimate,
  undoAdoption,
} from './estimate';
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
