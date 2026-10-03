import {
  createRootRoute,
  ErrorComponent,
  type ErrorComponentProps,
  createRoute,
  createRouter,
  redirect,
  type ParsedLocation,
  retainSearchParams,
  type RouterHistory,
} from '@tanstack/react-router';
import {
  BacklogScreen,
  validateBacklogSearch,
} from '@/screens/backlog/backlog-screen';
import { NotFoundScreen } from '@/screens/not-found-screen';
import { validateSprintSearch } from '@/screens/planning/planning-screen';
import { RetroScreen, validateRetroSearch } from '@/screens/retro/retro-screen';
import { SprintScreen } from '@/screens/sprint-screen';
import { TodayScreen, validateTodaySearch } from '@/screens/today/today-screen';
import { NotOnContractError } from '@/store/store-provider';
import { NotOnContract } from './not-on-contract';
import { usesMock } from './data-source';
import { AccountScreen } from '@/screens/account/account-screen';
import {
  SignInScreen,
  validateSignInSearch,
} from '@/screens/sign-in/sign-in-screen';
import { RootLayout } from './root-layout';
import { SIGN_IN_PATH } from './sign-in';

// Routes (ADR 0005). One path per screen. With the browser mock, the
// fixture state is a search parameter on the root, kept on every
// navigation, so that a URL opens the same records and clock; the mock
// checks it against the states (an unknown one opens the default). With the
// API there is no fixture, and the parameter is dropped. Screen state (a
// filter, an open detail) is added by each screen as its own search
// parameters. The sign-in screen stands outside the app's frame; every
// other screen is in it (root-layout.tsx, #278).

export interface RootSearch {
  /** The fixture state to open (PRD §12), with the mock only. */
  readonly fixture?: string | undefined;
}

const rootRoute = createRootRoute({
  // `undefined`, not left out, to drop the URL's value (ADR 0005).
  validateSearch: (search: Record<string, unknown>): RootSearch => ({
    fixture:
      usesMock && typeof search.fixture === 'string'
        ? search.fixture
        : undefined,
  }),
  search: {
    middlewares: usesMock ? [retainSearchParams(['fixture'])] : [],
  },
  component: RootLayout,
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: SIGN_IN_PATH,
  validateSearch: validateSignInSearch,
  component: SignInScreen,
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

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'account',
  component: AccountScreen,
});

const routeTree = rootRoute.addChildren([
  signInRoute,
  indexRoute,
  todayRoute,
  sprintRoute,
  backlogRoute,
  retroRoute,
  accountRoute,
]);

/**
 * The scroll rule (#111). The shell's `main` is what scrolls, so it is the
 * one the router is told about (`scrollToTopSelectors`; app-shell.tsx
 * marks it). Moving to another
 * screen, or to another stage of one, opens it from the top; going back or
 * forward restores where that entry was. Other changes to the search
 * (a filter, an open detail) leave the scroll alone, which is why the
 * router is asked only when the screen or the stage differs.
 */
function scrollOnNewView() {
  let previous: string | undefined;
  return ({ location }: { location: ParsedLocation }) => {
    const search = location.search as { stage?: unknown };
    const view = `${location.pathname}?${String(search.stage ?? '')}`;
    const isNew = previous !== view;
    previous = view;
    return isNew;
  };
}

export function createAppRouter(options: { history?: RouterHistory } = {}) {
  return createRouter({
    routeTree,
    scrollRestoration: scrollOnNewView(),
    scrollToTopSelectors: ['[data-scroll-restoration-id="main"]'],
    ...(options.history === undefined ? {} : { history: options.history }),
    defaultNotFoundComponent: NotFoundScreen,
    defaultErrorComponent: ScreenError,
  });
}

/**
 * A screen that failed. One not yet moved to the contract fails with the
 * API as the data source (no RecordStore) and says so, for the developer.
 */
function ScreenError(props: ErrorComponentProps) {
  return props.error instanceof NotOnContractError ? (
    <NotOnContract />
  ) : (
    <ErrorComponent {...props} />
  );
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
