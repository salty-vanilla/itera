import type { MouseEvent, ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

// DESIGN.md Components › Navigation. Moves between the screens (今日 / Sprint /
// Backlog / 振り返り). The current screen is a 4px `here` bar, `ink` 700 text
// and aria-current="page": the mark and the weight show it, the item is not
// filled. Up to 8 items.
//
// Layouts (DESIGN.md Layout › Responsive):
// - sidebar: 224px (`pane-nav`), 1440px and wider.
// - rail: 64px (`pane-rail`), icons only with the label in a Tooltip. Used
//   from 768px up to 1439px, so that the medium width keeps its two panes.
// - tab-bar: the bottom tab bar under 768px. It is a separate layout, not the
//   sidebar made smaller.
// `responsive` (the default) switches between them with the breakpoints.
// Routing belongs to the screens: items are plain links and `onNavigate` lets
// the caller take over the click.

type NavigationItem = {
  id: string;
  /** Screen name, e.g. 「今日」. Also the accessible name. */
  label: string;
  /** A 20px Lucide icon element with aria-hidden. */
  icon: ReactElement;
  href: string;
  /** Number of items on that screen. Omit it rather than showing 0. */
  count?: number;
  /** The item stays focusable and is announced as unavailable. */
  disabled?: boolean;
  /**
   * Shown in the bottom tab bar. Defaults to true; the bar holds 4 items.
   * Under 768px an item left out has no entry here: the screen must offer
   * another way to reach it.
   */
  inTabBar?: boolean;
};

type NavigationLayout = 'responsive' | 'sidebar' | 'rail' | 'tab-bar';

type NavigationProps = {
  items: NavigationItem[];
  /** id of the current screen. */
  current: string;
  onNavigate?: (id: string, event: MouseEvent<HTMLAnchorElement>) => void;
  /** Accessible name of the landmark. */
  label?: string;
  layout?: NavigationLayout;
  /** Classes for the sidebar or rail. */
  className?: string | undefined;
  /** Classes for the bottom tab bar, e.g. to fix it to the bottom. */
  tabBarClassName?: string | undefined;
};

type SideLayout = 'responsive' | 'sidebar' | 'rail';

// Classes per layout. `responsive` is the rail from 768px and the sidebar
// from 1440px (the `nav` breakpoint).
const side = {
  root: {
    sidebar: 'flex w-pane-nav',
    rail: 'flex w-pane-rail',
    responsive: 'hidden medium:flex w-pane-rail nav:w-pane-nav',
  },
  item: {
    sidebar: 'h-control-md justify-start gap-2 px-3',
    rail: 'h-control-lg justify-center',
    responsive:
      'h-control-lg justify-center nav:h-control-md nav:justify-start nav:gap-2 nav:px-3',
  },
  // In the rail the words are read, not shown; the Tooltip shows the label.
  text: {
    sidebar: '',
    rail: 'sr-only',
    responsive: 'sr-only nav:not-sr-only',
  },
  tooltip: {
    sidebar: 'hidden',
    rail: '',
    responsive: 'nav:hidden',
  },
} satisfies Record<string, Record<SideLayout, string>>;

const itemBase = [
  'relative flex w-full items-center rounded-sm text-body text-ink-muted',
  'transition-colors duration-(--duration-fast) ease-standard',
  'focus-visible:focus-ring-inset',
  '[&_svg]:pointer-events-none [&_svg]:size-icon-m [&_svg]:shrink-0 [&_svg]:[stroke-width:var(--icon-stroke-m)]',
  'not-aria-disabled:hover:bg-surface-hover not-aria-disabled:hover:text-ink',
  'not-aria-disabled:active:bg-surface-pressed',
  'aria-[current=page]:font-bold aria-[current=page]:text-ink',
  'aria-disabled:cursor-not-allowed aria-disabled:text-ink-disabled',
  // The `here` mark: a 4px bar on the leading edge, not a filled item.
  'before:absolute before:rounded-xs before:bg-here before:opacity-0 aria-[current=page]:before:opacity-100',
];

function Navigation({
  layout = 'responsive',
  className,
  tabBarClassName,
  ...props
}: NavigationProps) {
  if (layout === 'tab-bar') {
    return <NavigationTabBar className={tabBarClassName} {...props} />;
  }
  if (layout !== 'responsive') {
    return <NavigationSide layout={layout} className={className} {...props} />;
  }
  return (
    <>
      <NavigationSide layout="responsive" className={className} {...props} />
      <NavigationTabBar
        className={cn('medium:hidden', tabBarClassName)}
        {...props}
      />
    </>
  );
}

function linkProps(
  item: NavigationItem,
  current: string,
  onNavigate: NavigationProps['onNavigate'],
) {
  return {
    'data-slot': 'navigation-item',
    // A disabled item keeps no href but stays in the tab order so that it can
    // be found and announced (docs/design/accessibility.md).
    ...(item.disabled
      ? { role: 'link', 'aria-disabled': true, tabIndex: 0 }
      : { href: item.href }),
    'aria-current': item.id === current ? ('page' as const) : undefined,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (item.disabled) {
        event.preventDefault();
        return;
      }
      onNavigate?.(item.id, event);
    },
  };
}

function Count({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('text-num-s text-ink-subtle', className)}>
      {value}
      <span className="sr-only">件</span>
    </span>
  );
}

function NavigationSide({
  items,
  current,
  onNavigate,
  label = 'メイン',
  layout,
  className,
}: Omit<NavigationProps, 'layout' | 'tabBarClassName'> & {
  layout: SideLayout;
}) {
  return (
    <nav
      aria-label={label}
      data-slot="navigation"
      data-layout={layout}
      className={cn(
        'shrink-0 flex-col border-r border-border bg-canvas-subtle p-2',
        side.root[layout],
        className,
      )}
    >
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <Tooltip>
              <TooltipTrigger
                // The Tooltip repeats the accessible name; do not read it twice.
                describes={false}
                render={
                  <a
                    {...linkProps(item, current, onNavigate)}
                    className={cn(
                      itemBase,
                      'before:inset-y-1 before:left-0 before:w-1',
                      side.item[layout],
                    )}
                  />
                }
              >
                {item.icon}
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-left',
                    side.text[layout],
                  )}
                >
                  {item.label}
                </span>
                {item.count !== undefined && (
                  <Count value={item.count} className={side.text[layout]} />
                )}
              </TooltipTrigger>
              <TooltipContent side="right" className={side.tooltip[layout]}>
                {item.label}
                {item.count !== undefined && (
                  <span aria-hidden className="text-num-s">
                    {item.count}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavigationTabBar({
  items,
  current,
  onNavigate,
  label = 'メイン',
  className,
}: Omit<NavigationProps, 'layout' | 'tabBarClassName'>) {
  const tabs = items.filter((item) => item.inTabBar !== false);
  return (
    <nav
      aria-label={label}
      data-slot="navigation"
      data-layout="tab-bar"
      className={cn(
        'border-t border-border bg-canvas-subtle pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      <ul className="grid auto-cols-fr grid-flow-col">
        {tabs.map((item) => (
          <li key={item.id}>
            <a
              {...linkProps(item, current, onNavigate)}
              className={cn(
                itemBase,
                // 44px or more to touch: 8 + 20 + 4 + 16 + 8 = 56px.
                'flex-col justify-center gap-1 rounded-none py-2 text-meta',
                'before:inset-x-3 before:top-0 before:h-1',
              )}
            >
              {item.icon}
              <span className="max-w-full truncate">{item.label}</span>
              {item.count !== undefined && (
                <Count value={item.count} className="sr-only" />
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { Navigation };
export type { NavigationItem, NavigationLayout, NavigationProps };
