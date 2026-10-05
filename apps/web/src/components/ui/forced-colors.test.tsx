// jsdom has no forced-colors mode, so this keeps the two halves of #394
// together: the parts drawn only by a `bg-*` background carry a `data-slot`,
// and the forced-colors block of globals.css has a rule for it with
// `!important` (the `bg-*` utilities, a later layer, win over a base rule
// otherwise, as they did for the Capacity bar in #359). Computed colours were
// measured in Chromium with `forcedColors: 'active'` (see the PR). #400 adds
// the pressed state of Button and IconButton, whose `bg-primary` and
// `bg-here-subtle` fills would otherwise turn Canvas, the same as unpressed.
import { cleanup, render, waitFor } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forcedColorsBlock, forcedColorsRule } from '@/test/forced-colors';
import { Button } from './button';
import { Divider, DividerLabel } from './divider';
import { Drawer, DrawerContent, DrawerTitle } from './drawer';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from './menu';
import { IconButton } from './icon-button';
import { Navigation } from './navigation';
import { Progress } from './progress';
import { Tabs, TabsList, TabsTab } from './tabs';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Each part: the selector of its rule, and what to render so that the part
// is in the document.
const parts: { name: string; selector: string; show: () => void }[] = [
  {
    name: 'Divider',
    selector: "[data-slot='divider']",
    show: () => void render(<Divider />),
  },
  {
    name: 'the line of a Divider label',
    selector: "[data-slot='divider-label'] > [aria-hidden]",
    show: () => void render(<DividerLabel>今週</DividerLabel>),
  },
  {
    name: 'the Progress fill',
    selector: "[data-slot='progress-indicator']",
    show: () => void render(<Progress label="完了" value={7} max={18} />),
  },
  {
    name: 'the Menu separator',
    selector: "[data-slot='menu-separator']",
    show: () =>
      void render(
        <Menu defaultOpen>
          <MenuTrigger>操作</MenuTrigger>
          <MenuContent>
            <MenuItem>今日へ</MenuItem>
            <MenuSeparator />
            <MenuItem>アーカイブ</MenuItem>
          </MenuContent>
        </Menu>,
      ),
  },
  {
    name: 'the grip of the Bottom Sheet',
    selector: "[data-slot='drawer-grip']",
    // Under 768px, matchMedia says the medium query does not match.
    show: () => {
      vi.stubGlobal(
        'matchMedia',
        (query: string) =>
          ({
            matches: false,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
          }) as unknown as MediaQueryList,
      );
      render(
        <Drawer defaultOpen>
          <DrawerContent>
            <DrawerTitle>タスクの詳細</DrawerTitle>
          </DrawerContent>
        </Drawer>,
      );
    },
  },
  {
    name: 'the selected tab underline',
    selector: "[data-slot='tabs-tab']::after",
    show: () =>
      void render(
        <Tabs defaultValue="detail">
          <TabsList aria-label="情報">
            <TabsTab value="detail">詳細</TabsTab>
          </TabsList>
        </Tabs>,
      ),
  },
  {
    name: 'the current screen bar',
    selector: "[data-slot='navigation-item']::before",
    show: () =>
      void render(
        <Navigation
          items={[
            { id: 'a', label: '今日', icon: <Inbox aria-hidden />, href: '#a' },
          ]}
          current="a"
          layout="sidebar"
        />,
      ),
  },
];

describe('Lines and fills drawn by a background, in forced colors (#394)', () => {
  it.each(parts)(
    '$name has a CanvasText rule that beats bg-*',
    async (part) => {
      part.show();
      const host = part.selector.replace(/::(before|after)$/, '');
      // Popups mount after the first render.
      await waitFor(() => expect(document.querySelector(host)).not.toBeNull());
      expect(forcedColorsRule(part.selector)).toContain(
        'background-color: CanvasText !important',
      );
    },
  );

  it('keeps the system colour on the lines and the fill (forced-color-adjust: none)', () => {
    for (const selector of [
      "[data-slot='divider']",
      "[data-slot='menu-separator']",
      "[data-slot='drawer-grip']",
      "[data-slot='progress-indicator']",
    ]) {
      expect(forcedColorsRule(selector)).toContain('forced-color-adjust: none');
    }
  });

  it('gives the Progress track an outline, as for the Capacity bar', () => {
    expect(forcedColorsBlock()).toContain("[data-slot='progress-track']");
  });
});

// Button and IconButton are toggles with `aria-pressed`; both looks of
// IconButton (`invert` and `selection`) carry the same attribute.
const toggles: { name: string; slot: string; show: () => void }[] = [
  {
    name: 'Button',
    slot: 'button',
    show: () => void render(<Button pressed>振り返りに使う</Button>),
  },
  {
    name: 'IconButton',
    slot: 'icon-button',
    show: () =>
      void render(
        <IconButton label="振り返りに使う" icon={<Inbox />} pressed />,
      ),
  },
  {
    name: 'IconButton (selection)',
    slot: 'icon-button',
    show: () =>
      void render(
        <IconButton
          label="振り返りに使う"
          icon={<Inbox />}
          pressed
          pressedLook="selection"
        />,
      ),
  },
];

describe('A pressed toggle, in forced colors (#400)', () => {
  it.each(toggles)(
    '$name when on is told apart by a Highlight fill and an outline',
    ({ slot, show }) => {
      show();
      expect(
        document.querySelector(`[data-slot='${slot}'][aria-pressed='true']`),
      ).not.toBeNull();
      const on = `[data-slot='${slot}'][aria-pressed='true']`;
      expect(forcedColorsRule(on)).toContain('outline:');
      // `!important`: the `bg-*` and `text-*` utilities, a later layer, win
      // over a base rule otherwise.
      const fill = forcedColorsRule(`${on}:not([data-disabled])`);
      expect(fill).toContain('background-color: Highlight !important');
      expect(fill).toContain('color: HighlightText !important');
    },
  );

  it('leaves a disabled toggle with its GrayText and only the outline', () => {
    const rule = forcedColorsRule("[data-slot='button'][data-disabled]");
    expect(rule).toContain('color: GrayText');
    expect(forcedColorsBlock()).toContain(
      "[data-slot='button'][aria-pressed='true']:not([data-disabled])",
    );
  });
});
