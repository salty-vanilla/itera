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
