import type { DailySelection } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import type { PastDayRecord } from '@/store/use-running-sprint';
import { consequence } from './past-days';

// The undo Dialog's words for each way a day can be left (F17, F29, F33).
const record = (
  resolution: 'done' | 'skipped',
  after: PastDayRecord['after'],
  recurring = false,
): PastDayRecord => ({
  selection: { resolution } as DailySelection,
  title: '住民税の支払い',
  recurring,
  after,
});

describe('consequence (#209)', () => {
  it('leaves the day unresolved and the Task back in the week (F33)', () => {
    expect(consequence(record('done', { kind: 'unresolved' }))).toBe(
      'その日の記録は未完了に戻り、タスクは今週の残りに戻ります。取り消したあと、その日の記録をもう一度完了にはできません。',
    );
  });

  it('returns the day to the way it had been closed (F17)', () => {
    expect(
      consequence(record('done', { kind: 'closed', resolution: 'deferred' })),
    ).toBe(
      'その日の記録は「見送り」に戻り、タスクは今週の残りに戻ります。取り消したあと、その日の記録をもう一度完了にはできません。',
    );
    expect(
      consequence(record('done', { kind: 'closed', resolution: 'paused' })),
    ).toBe(
      'その日の記録は「中断」に戻り、タスクは今週の残りに戻ります。取り消したあと、その日の記録をもう一度完了にはできません。',
    );
  });

  it('says the record goes for a choice put back to the week, which no other day lists (#233)', () => {
    expect(
      consequence(record('done', { kind: 'closed', resolution: 'removed' })),
    ).toBe(
      'その日の記録は消え、タスクは今週の残りに戻ります。取り消したあと、その日の記録をもう一度完了にはできません。',
    );
  });

  it('removes the record of a completion from the Backlog (F29)', () => {
    expect(consequence(record('done', { kind: 'gone' }))).toBe(
      'その日の記録は消え、タスクは今週の残りに戻ります。取り消したあと、その日の記録をもう一度完了にはできません。',
    );
  });

  it('puts a skipped occurrence back to pending', () => {
    expect(consequence(record('skipped', { kind: 'unresolved' }, true))).toBe(
      'その日の記録と繰り返しは未完了に戻ります。取り消したあと、その日の記録をもう一度スキップにはできません。',
    );
  });

  it('names the occurrence 「繰り返し」 when the day is closed or gone (#205)', () => {
    expect(
      consequence(
        record('done', { kind: 'closed', resolution: 'deferred' }, true),
      ),
    ).toBe(
      'その日の記録は「見送り」に戻り、繰り返しは未完了に戻ります。取り消したあと、その日の記録をもう一度完了にはできません。',
    );
    expect(consequence(record('done', { kind: 'gone' }, true))).toBe(
      'その日の記録は消え、繰り返しは未完了に戻ります。取り消したあと、その日の記録をもう一度完了にはできません。',
    );
  });
});
