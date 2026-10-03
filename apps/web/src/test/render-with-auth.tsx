// A screen with a given Auth, for the outcomes the browser mock never has
// (a stale sign-in, a failure): the screen's route alone, under the
// providers the app gives it.
import { QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  type RouteComponent,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';

import { createQueryClient } from '@/api/query-client';
import type { Auth } from '@/auth/auth';
import { AuthProvider } from '@/auth/auth-provider';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

/** An Auth that is signed in and does everything; override what a test needs. */
export function fakeAuth(overrides: Partial<Auth> = {}): Auth {
  return {
    getSession: async () => ({ email: 'you@example.com', name: 'あなた' }),
    signInWithGoogle: async () => true,
    signInWithPasskey: async () => ({ ok: true }),
    listPasskeys: async () => [],
    addPasskey: async () => ({ ok: true }),
    signOut: async () => {},
    ...overrides,
  };
}

export function renderWithAuth({
  auth,
  path,
  component,
  validateSearch,
  url,
}: {
  auth: Auth;
  path: string;
  component: RouteComponent;
  validateSearch?: (search: Record<string, unknown>) => object;
  url: string;
}) {
  const queryClient = createQueryClient({ onUnauthenticated: () => {} });
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider auth={auth}>
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    ),
  });
  const screenRoute = createRoute({
    getParentRoute: () => rootRoute,
    path,
    component,
    ...(validateSearch === undefined ? {} : { validateSearch }),
  });
  const otherRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '$',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([screenRoute, otherRoute]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
  return { router, queryClient };
}
