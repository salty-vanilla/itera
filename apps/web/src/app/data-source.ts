// Where the screens' records come from (ADR 0005):
// - the browser mock, in development (`pnpm --filter @itera/web dev`): the
//   fixture states of PRD §12, opened from the dev menu and the URL;
// - the API, in the production build and with `--mode api` in development
//   (`pnpm --filter @itera/web dev:api`), through the dev server's `/api`
//   proxy to `wrangler dev`.
// The production build holds neither the mock nor the fixture: there
// `import.meta.env.DEV` is false, the import below is dead code and Vite
// drops the chunk. The condition is written here only, and inline: behind
// a constant of another module the chunk stays (scripts/check-build.mjs
// checks the output). Loaded before the app renders, so the first screen
// does not wait for it.
import type { ReactNode } from 'react';

/** The browser mock's data source, or `null` when the API answers. */
export const MockData: ((props: { children: ReactNode }) => ReactNode) | null =
  import.meta.env.DEV && import.meta.env.MODE !== 'api'
    ? (await import('@/mock/mock-data')).MockData
    : null;

/** Whether the browser mock answers the API's requests. */
export const usesMock = MockData !== null;
