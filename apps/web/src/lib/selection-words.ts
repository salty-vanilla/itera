// How a day's choice ended, in the screens' words: a past day on Today, the
// running Sprint's 「日ごとの記録」, and the Retro's facts. A choice still
// open at the end of its day is closed by the system as unresolved (F33).
import type { DailySelection } from '@itera/domain';

export const SELECTION_WORDS: Readonly<
  Record<DailySelection['resolution'], string>
> = {
  selected: '未処理',
  started: '未処理',
  unresolved: '未処理',
  done: '完了',
  skipped: 'スキップ',
  paused: '今日はここまで',
  deferred: '見送り',
  removed: '予定から外した',
};
