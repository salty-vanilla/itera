// How a day's choice ended, in the screens' words: a past day on Today, the
// running Sprint's 「日ごとの記録」, and the Retro's facts. A choice still
// open at the end of its day is closed by the system as unresolved (F33).
// The same words for today and for another day (#233). A choice put back
// with 今週の残りに戻す (Removed) is not listed on another day (#233).
import type { DailySelection } from '@itera/api-contract';

export const SELECTION_WORDS: Readonly<
  Record<DailySelection['resolution'], string>
> = {
  selected: '未完了',
  started: '未完了',
  unresolved: '未完了',
  done: '完了',
  skipped: 'スキップ',
  paused: '中断',
  deferred: '見送り',
  // Not shown: a choice put back is left out of another day's records, and
  // the day records' undo words say the record goes (#233).
  removed: '今週の残りに戻した',
};
