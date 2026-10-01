import type { Instant, TimeZone } from '@itera/domain';
import { formatTime } from './date-format';

/**
 * What 今日はここまで, 今日は見送る, スキップ and 今日から外す do, to read
 * before pressing them (#163): under the items of a Today row's `…` and
 * under the buttons of the Task's detail. 見送り is told apart from 外す by
 * what it leaves (「N回続けて見送り」, F4), without counting it against
 * anyone (docs/design/content.md).
 */
const closingHelp = {
  pause: '進めた分を残し、明日に続けます',
  defer: '今日はやらないと決めます',
  skip: 'この回はやりません',
  remove: '選び直します。見送りに入れません',
} as const;

/** 「作業中 · 10:12 から」 for a started selection, or 「作業中」 without the time. */
function startedText(startedAt: Instant | undefined, timeZone: TimeZone) {
  return startedAt === undefined
    ? '作業中'
    : `作業中 · ${formatTime(startedAt, timeZone)} から`;
}

export { closingHelp, startedText };
