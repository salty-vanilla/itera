import { waitForRead } from './read-ready';

/**
 * Waits for the Today screen to have read its day: it is marked busy
 * (`aria-busy`) until `getDay` has answered.
 */
export const dayRead = waitForRead;
