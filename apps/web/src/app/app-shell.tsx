import { useLocation, useNavigate, useRouter } from '@tanstack/react-router';
import { Inbox, NotebookPen, Route, Sun } from 'lucide-react';
import { useRef, type ReactElement, type ReactNode } from 'react';
import { Navigation, type NavigationItem } from '@/components/ui/navigation';
import type { ScreenId } from '@/fixtures/states';
import { isPlainClick } from '@/lib/plain-click';
import { useToastClearance } from './use-toast-clearance';
import { useAppOverview } from '@/store/use-app-overview';
import { screens } from './screens';

const icons: Record<ScreenId, ReactElement> = {
  today: <Sun aria-hidden />,
  sprint: <Route aria-hidden />,
  backlog: <Inbox aria-hidden />,
  retro: <NotebookPen aria-hidden />,
};

/**
 * The app's frame (DESIGN.md Layout › Responsive, Navigation): the sidebar
 * (224px) from 1440px, the rail (64px) from 768px, and under 768px the
 * bottom tab bar under a one-column screen.
 */
function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { backlogCount } = useAppOverview();
  const mainRef = useRef<HTMLElement>(null);
  useToastClearance(mainRef);

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
        // The router resets and restores this element's scroll (router.tsx).
        data-scroll-restoration-id="main"
        className="min-h-0 flex-1 overflow-auto pb-[var(--toast-clearance,0px)]"
      >
        {children}
      </main>
    </div>
  );
}

export { AppShell };
