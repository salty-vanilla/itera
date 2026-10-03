// How a day's choice ended, in the screens' words: a past day on Today, the
// running Sprint's 「日ごとの記録」, and the Retro's facts. A choice still
// open at the end of its day is closed by the system as unresolved (F33).
// The same words for today and for another day (#233). A choice put back
// with 今週の残りに戻す (Removed) is not listed on another day (#233).
import type { DailyResolution } from '@itera/api-contract';

export const SELECTION_WORDS: Readonly<Record<DailyResolution, string>> = {
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

// What becomes of a choice closed for the day. Normally it is back in 今週の
// 残り from tomorrow. On the Sprint's last day there is no tomorrow in the
// Sprint: what is left over is chosen in the next Sprint's planning. A
// recurring Task's occurrence is not carried over (F20), so these lines say
// only where to choose, not 「持ち越し」 (#314). The screens use them only
// when the read says `lastDay` (ADR 0007).
export const LAST_DAY_CLOSED_WORDS = {
  /** 「今日はもうやらない」 in Today and the pause surface. */
  section: '終わっていないタスクは、次の Sprint の計画で選べます。',
  /** After 今日は中断しました。 / 今日は見送りました。 in the Task detail. */
  detail: '次の Sprint の計画で選べます。',
} as const;
