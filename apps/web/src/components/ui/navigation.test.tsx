import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox, Settings, Sun } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { Navigation, type NavigationItem } from './navigation';

afterEach(cleanup);

const items: NavigationItem[] = [
  { id: 'today', label: '今日', icon: <Sun aria-hidden />, href: '#today' },
  {
    id: 'backlog',
    label: 'Backlog',
    icon: <Inbox aria-hidden />,
    href: '#backlog',
    count: 42,
  },
  {
    id: 'settings',
    label: '設定',
    icon: <Settings aria-hidden />,
    href: '#settings',
    disabled: true,
    inTabBar: false,
  },
];

describe('Navigation', () => {
  it('marks the current screen with aria-current="page"', () => {
    render(<Navigation items={items} current="today" layout="sidebar" />);
    const nav = screen.getByRole('navigation', { name: 'メイン' });
    const today = within(nav).getByRole('link', { name: '今日' });
    expect(today.getAttribute('aria-current')).toBe('page');
    expect(today.getAttribute('href')).toBe('#today');
    const backlog = within(nav).getByRole('link', { name: /^Backlog\s?42件$/ });
    expect(backlog.getAttribute('aria-current')).toBeNull();
  });

  it('keeps a disabled item focusable and ignores presses', async () => {
    const visited: string[] = [];
    render(
      <Navigation
        items={items}
        current="today"
        layout="sidebar"
        onNavigate={(id) => visited.push(id)}
      />,
    );
    const settings = screen.getByRole('link', { name: '設定' });
    expect(settings.getAttribute('aria-disabled')).toBe('true');
    expect(settings.getAttribute('href')).toBeNull();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(settings);
    await userEvent.click(settings);
    expect(visited).toEqual([]);
  });

  it('reports the chosen item', async () => {
    const visited: string[] = [];
    render(
      <Navigation
        items={items}
        current="today"
        layout="rail"
        onNavigate={(id, event) => {
          event.preventDefault();
          visited.push(id);
        }}
      />,
    );
    await userEvent.click(
      screen.getByRole('link', { name: /^Backlog\s?42件$/ }),
    );
    expect(visited).toEqual(['backlog']);
  });

  it('shows the label in a tooltip in the rail', async () => {
    render(<Navigation items={items} current="today" layout="rail" />);
    await userEvent.tab();
    expect((await screen.findByRole('tooltip')).textContent).toBe('今日');
  });

  it('leaves items out of the tab bar when asked', () => {
    render(<Navigation items={items} current="today" layout="tab-bar" />);
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(
      ['今日', 'Backlog42件'],
    );
  });
});
