// The durations the code needs as numbers (a timer, a Base UI prop). The CSS
// ones are read from the variables in styles/tokens.css; these are their
// copies in milliseconds, and styles/tokens.test.ts keeps them equal. Change
// a value in tokens.css (and docs/design/foundations.md), not only here.

/** `duration-toast`: how long a Toast shows. */
export const TOAST_TIMEOUT = 8000;
/**
 * `duration-toast-action`: a Toast with an action (元に戻す, 今日を開く) is
 * pressed after it is read, and it takes longer to reach (#170).
 */
export const TOAST_ACTION_TIMEOUT = 16000;
/** `tooltip-delay`: how long the pointer rests before a Tooltip opens. */
export const TOOLTIP_DELAY = 400;
/**
 * `duration-added-flash`: how long the screens keep a row as just added. The
 * flash itself is `animate-added-flash`, which runs for the same variable.
 */
export const ADDED_MS = 2500;
