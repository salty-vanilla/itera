import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  retainSearchParams,
  type RouterHistory,
} from '@tanstack/react-router';
import { isFixtureStateId, type FixtureStateId } from '@/fixtures/states';
import {
  BacklogScreen,
  validateBacklogSearch,
} from '@/screens/backlog/backlog-screen';
import { NotFoundScreen } from '@/screens/not-found-screen';
import { validateSprintSearch } from '@/screens/planning/planning-screen';
import { RetroScreen, validateRetroSearch } from '@/screens/retro/retro-screen';
import { SprintScreen } from '@/screens/sprint-screen';
import { TodayScreen, validateTodaySearch } from '@/screens/today/today-screen';
import { RootLayout } from './root-layout';

// Routes (ADR 0005). One path per screen; the fixture state is a search
// parameter on the root, kept on every navigation, so that a URL opens the
// same records and clock. Screen state (a filter, an open detail) is added
// by each screen as its own search parameters.

export interface RootSearch {
  /** The fixture state to open (PRD §12). Absent: the default state. */
  readonly fixture?: FixtureStateId;
}

const rootRoute = createRootRoute({
  validateSearch: (search: Record<string, unknown>): RootSearch =>
    isFixtureStateId(search.fixture) ? { fixture: search.fixture } : {},
  search: { middlewares: [retainSearchParams(['fixture'])] },
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/today' });
  },
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'today',
  validateSearch: validateTodaySearch,
  component: TodayScreen,
});

const sprintRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'sprint',
  validateSearch: validateSprintSearch,
  component: SprintScreen,
});

const backlogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'backlog',
  validateSearch: validateBacklogSearch,
  component: BacklogScreen,
});

const retroRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'retro',
  validateSearch: validateRetroSearch,
  component: RetroScreen,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  sprintRoute,
  backlogRoute,
  retroRoute,
]);

export function createAppRouter(options: { history?: RouterHistory } = {}) {
  return createRouter({
    routeTree,
    ...(options.history === undefined ? {} : { history: options.history }),
    defaultNotFoundComponent: NotFoundScreen,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
