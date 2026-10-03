import type { Change } from '@itera/application';
import { ok } from '@itera/domain';

/**
 * What the system does when the date has moved on since the records were
 * last written (the end of a Sprint, the start of a day), run as the
 * system before every operation and read (ADR 0004 「操作と読み取りの処理」
 * step 5). Its content is #271's; until then the records need nothing.
 */
export const catchUp: Change = () => ok({ changes: {}, activities: [] });
