// Where the screens' records come from (ADR 0005):
// - the browser mock, in development (`pnpm --filter @itera/web dev`): the
//   fixture states of PRD §12, opened from the dev menu and the URL;
// - the API, in the production build and with `--mode api` in development
//   (`pnpm --filter @itera/web dev:api`), through the dev server's `/api`
//   proxy to `wrangler dev`.
// The production build holds neither the mock nor the fixture
// (scripts/check-build.mjs checks the output).

/** Whether the browser mock answers the API's requests. */
export const usesMock = import.meta.env.DEV && import.meta.env.MODE !== 'api';

/**
 * The contract's base URL on this origin (ADR 0004 Web と API の配信).
 * Absolute, as `Request` outside a browser needs one (the tests).
 */
export function apiBaseUrl(): string {
  return new URL('/api', window.location.origin).href;
}
