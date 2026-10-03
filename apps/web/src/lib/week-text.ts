import type { SprintWeek } from '@itera/application';

/** A Sprint's name next to now, for headings and sentences (#90). */
export type WeekName = '今週' | '来週';

/**
 * The name beside the period in the Sprint Header: 「先週」 (#168) goes
 * nowhere else, so that a sentence takes a WeekName, not this.
 */
export type WeekLabel = '先週' | WeekName;

const LABELS: Readonly<Record<SprintWeek, WeekLabel>> = {
  previous: '先週',
  current: '今週',
  next: '来週',
};

/** The name of a Sprint's place next to now, for the Sprint Header. */
export function weekLabel(week: SprintWeek | undefined): WeekLabel | undefined {
  return week === undefined ? undefined : LABELS[week];
}

/** The name a sentence may use: 「先週」 stays in the Sprint Header (#168). */
export function weekNameOnly(
  week: SprintWeek | undefined,
): WeekName | undefined {
  const label = weekLabel(week);
  return label === '先週' ? undefined : label;
}

/** 「今週」「来週」, or 「Sprint N」 for a Sprint that is neither (#90). */
export function weekCall(week: SprintWeek | undefined, number: number): string {
  const name = weekNameOnly(week);
  return name ?? `Sprint ${number}`;
}

/**
 * The week's name and the words after it (#90): 「今週に入れる」, and
 * 「Sprint 3 に入れる」 with a space after Latin script and numbers
 * (docs/design/content.md). Punctuation follows without one.
 */
export function weekText(week: string, words: string): string {
  return /[A-Za-z0-9]$/.test(week) && !/^[、。）]/.test(words)
    ? `${week} ${words}`
    : `${week}${words}`;
}
