import { useLocation, useNavigate, useRouter } from '@tanstack/react-router';
import { Inbox, Rewind, Route, Sun } from 'lucide-react';
import { useRef, type ReactElement, type ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Navigation, type NavigationItem } from '@/components/ui/navigation';
import type { ScreenId } from '@/fixtures/states';
import { isPlainClick } from '@/lib/plain-click';
import { cn } from '@/lib/utils';
import { useCloseToastsOnScreenChange } from './use-close-toasts-on-screen-change';
import { focusScreenHeading, useScreenFocus } from './use-screen-focus';
import { useToastClearance } from './use-toast-clearance';
import { useAppOverview } from '@/store/use-app-overview';
import { screens } from './screens';

const icons: Record<ScreenId, ReactElement> = {
  today: <Sun aria-hidden />,
  sprint: <Route aria-hidden />,
  backlog: <Inbox aria-hidden />,
  retro: <Rewind aria-hidden />,
};

/**
 * The app's frame (DESIGN.md Layout › Responsive, Navigation): the sidebar
 * (224px) from 1440px, the rail (64px, icons with names) from 768px, and
 * under 768px the bottom tab bar under a one-column screen.
 */
function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { backlogCount } = useAppOverview();
  const mainRef = useRef<HTMLElement>(null);
  useToastClearance(mainRef);
  useScreenFocus(mainRef);
  useCloseToastsOnScreenChange();

  const items: NavigationItem[] = screens.map((screen) => ({
    id: screen.id,
    label: screen.label,
    icon: icons[screen.id],
    // The fixture search parameter is kept (ADR 0005); the Sprint and the
    // day are not, so the navigation opens the current ones (#90).
    href: router.buildLocation({ to: screen.path }).href,
    ...(screen.id === 'backlog' ? { count: backlogCount } : {}),
  }));
  const current =
    screens.find((screen) => pathname.startsWith(screen.path))?.id ?? '';

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
        current={current}
        onNavigate={(id, event) => {
          const screen = screens.find((s) => s.id === id);
          if (screen === undefined || !isPlainClick(event)) return;
          event.preventDefault();
          void navigate({ to: screen.path });
        }}
      />
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
  );
}

export { AppShell };
