import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Tabs. Switches what is shown in the same place, up to
// 5 tabs. Do not use Tabs to move through the stages of a flow (→ Sprint
// Header) or to narrow a list (→ Filter).
//
// Tabs are 40px with `button` labels. The selected tab is `ink` 700 with a
// `stroke-strong` underline, never a fill or a Pill; the others are
// `ink-muted` 400. Counts are `ink-subtle`. Keyboard: ← → move and select,
// Home / End, roving tabindex (docs/design/accessibility.md).

function Tabs({
  className,
  ...props
}: Omit<TabsPrimitive.Root.Props, 'className'> & { className?: string }) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col', className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  activateOnFocus = true,
  ...props
}: Omit<TabsPrimitive.List.Props, 'className'> & { className?: string }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      activateOnFocus={activateOnFocus}
      className={cn('flex border-b border-border', className)}
      {...props}
    />
  );
}

type TabsTabProps = Omit<TabsPrimitive.Tab.Props, 'className' | 'children'> & {
  children: ReactNode;
  /** Number of items behind the tab. Omit it rather than showing 0. */
  count?: number;
  className?: string;
};

function TabsTab({ className, children, count, ...props }: TabsTabProps) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        'group relative inline-flex h-10 shrink-0 items-center gap-1 px-3 text-button font-normal text-ink-muted select-none',
        'transition-colors duration-(--duration-fast) ease-standard',
        'focus-visible:focus-ring-inset',
        'not-data-disabled:hover:bg-surface-hover not-data-disabled:hover:text-ink',
        'data-active:text-ink',
        'data-disabled:cursor-not-allowed data-disabled:text-ink-disabled',
        // The underline sits on the list's bottom border.
        'after:absolute after:inset-x-0 after:-bottom-px after:h-(--stroke-strong) after:bg-ink after:opacity-0 data-active:after:opacity-100',
        className,
      )}
      {...props}
    >
      <TabLabel>{children}</TabLabel>
      {count !== undefined && (
        <span className="text-num-s text-ink-subtle group-data-disabled:text-ink-disabled">
          {count}
          <span className="sr-only">件</span>
        </span>
      )}
    </TabsPrimitive.Tab>
  );
}

// The bold and regular labels share one grid cell so that selecting a tab
// does not change its width and move the tabs after it.
function TabLabel({ children }: { children: ReactNode }) {
  return (
    <span className="grid">
      <span aria-hidden className="invisible col-start-1 row-start-1 font-bold">
        {children}
      </span>
      <span className="col-start-1 row-start-1 group-data-active:font-bold">
        {children}
      </span>
    </span>
  );
}

function TabsPanel({
  className,
  ...props
}: Omit<TabsPrimitive.Panel.Props, 'className'> & { className?: string }) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn('focus-visible:focus-ring-inset', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsPanel, TabsTab };
export type { TabsTabProps };
