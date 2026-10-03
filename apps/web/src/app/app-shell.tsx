import {
  Link,
  useLocation,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { Inbox, Rewind, Route, Settings, Sun } from 'lucide-react';
import { useRef, type ReactElement, type ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { iconButtonVariants } from '@/components/ui/icon-button';
import { Navigation, type NavigationItem } from '@/components/ui/navigation';
import { isPlainClick } from '@/lib/plain-click';
import { getBacklogOptions } from '@itera/api-contract/react-query';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/api/api-provider';
import { useMe } from '@/api/use-me';
import { cn } from '@/lib/utils';
import { useCloseToastsOnScreenChange } from './use-close-toasts-on-screen-change';
import { focusScreenHeading, useScreenFocus } from './use-screen-focus';
import { useToastClearance } from './use-toast-clearance';
import { screens, type ScreenId } from './screens';

const icons: Record<ScreenId, ReactElement> = {
  today: <Sun aria-hidden />,
  sprint: <Route aria-hidden />,
  backlog: <Inbox aria-hidden />,
  retro: <Rewind aria-hidden />,
};

const SETTINGS = { id: 'settings', path: '/settings', label: '設定' } as const;

/**
 * The app's frame (DESIGN.md Layout › Responsive, Navigation): the sidebar
 * (224px) from 1440px, the rail (64px, icons with names) from 768px, and
 * under 768px the bottom tab bar under a one-column screen. The settings
 * screen is the navigation's last item; the tab bar keeps its four, and
 * under 768px the settings are the button at the top right of every screen
 * (DESIGN.md Navigation, #278).
 */
function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  // The Backlog's count, read through the contract (#272, #295: the
  // Backlog is the resource); absent until it is.
  const backlogCount = useQuery(getBacklogOptions({ client: useApiClient() }))
    .data?.view.sliceCounts.all;
  // The person's Sprints are read with the frame, so that what asks where
  // the next Planning starts (「Sprint N の計画を始める」) has the answer when
  // it appears, not a moment after.
  useMe();
  const mainRef = useRef<HTMLElement>(null);
  useToastClearance(mainRef);
  useScreenFocus(mainRef);
  useCloseToastsOnScreenChange();

  const items: NavigationItem[] = [
    ...screens.map((screen) => ({
      id: screen.id,
      label: screen.label,
      icon: icons[screen.id],
      // The fixture search parameter is kept (ADR 0005); the Sprint and the
      // day are not, so the navigation opens the current ones (#90).
      href: router.buildLocation({ to: screen.path }).href,
      ...(screen.id === 'backlog' && backlogCount !== undefined
        ? { count: backlogCount }
        : {}),
    })),
    {
      id: SETTINGS.id,
      label: SETTINGS.label,
      icon: <Settings aria-hidden />,
      href: router.buildLocation({ to: SETTINGS.path }).href,
      inTabBar: false,
    },
  ];
  const current =
    [...screens, SETTINGS].find((screen) => pathname.startsWith(screen.path))
      ?.id ?? '';

  return (
    <div className="flex h-dvh flex-col-reverse bg-canvas text-ink medium:flex-row">
      {/* WCAG 2.4.1 (#154): first in the Tab order, seen only with the
          focus. It goes to the screen's heading, as moving to a screen does,
          rather than following the hash, which would add a history entry. */}
      <a
        href="#main"
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          focusScreenHeading(mainRef.current);
        }}
        className={cn(
          buttonVariants({ variant: 'secondary' }),
          'fixed start-2 top-2 z-(--layer-tooltip) not-focus:sr-only',
        )}
      >
        本文へ移動
      </a>
      <Navigation
        items={items}
        brand="Itera"
        current={current}
        onNavigate={(id, event) => {
          const screen = [...screens, SETTINGS].find((s) => s.id === id);
          if (screen === undefined || !isPlainClick(event)) return;
          event.preventDefault();
          void navigate({ to: screen.path });
        }}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex justify-end px-2 pt-1 medium:hidden">
          <Link
            to={SETTINGS.path}
            aria-label={SETTINGS.label}
            aria-current={current === SETTINGS.id ? 'page' : undefined}
            className={cn(
              iconButtonVariants({ variant: 'quiet', size: 'md' }),
              'aria-[current=page]:text-ink',
            )}
          >
            <Settings aria-hidden />
          </Link>
        </div>
        <main
          ref={mainRef}
          id="main"
          // The router resets and restores this element's scroll (router.tsx).
          data-scroll-restoration-id="main"
          // `relative` makes the `main` the containing block of `sr-only`
          // (absolute) text, so `overflow-auto` clips it and the document
          // never grows past the shell (#149).
          className="relative min-h-0 flex-1 overflow-auto pb-[var(--toast-clearance,0px)]"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export { AppShell };
