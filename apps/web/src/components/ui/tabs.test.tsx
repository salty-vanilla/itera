import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Tabs, TabsList, TabsPanel, TabsTab } from './tabs';

afterEach(cleanup);

function Example() {
  return (
    <Tabs defaultValue="detail">
      <TabsList aria-label="タスクの情報">
        <TabsTab value="detail">詳細</TabsTab>
        <TabsTab value="subtasks" count={3}>
          サブタスク
        </TabsTab>
        <TabsTab value="history">変更履歴</TabsTab>
      </TabsList>
      <TabsPanel value="detail">詳細の中身</TabsPanel>
      <TabsPanel value="subtasks">サブタスクの中身</TabsPanel>
      <TabsPanel value="history">変更履歴の中身</TabsPanel>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('exposes a tablist with the selected tab', () => {
    render(<Example />);
    expect(screen.getByRole('tablist', { name: 'タスクの情報' })).toBeTruthy();
    const detail = screen.getByRole('tab', { name: '詳細' });
    expect(detail.getAttribute('aria-selected')).toBe('true');
    const subtasks = screen.getByRole('tab', { name: /^サブタスク\s?3件$/ });
    expect(subtasks.getAttribute('aria-selected')).toBe('false');
  });

  it('moves and selects with the arrow keys, Home and End', async () => {
    render(<Example />);
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe('詳細詳細');
    await userEvent.keyboard('{ArrowRight}');
    const subtasks = screen.getByRole('tab', { name: /^サブタスク\s?3件$/ });
    expect(document.activeElement).toBe(subtasks);
    expect(subtasks.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('サブタスクの中身');
    await userEvent.keyboard('{End}');
    expect(
      screen
        .getByRole('tab', { name: '変更履歴' })
        .getAttribute('aria-selected'),
    ).toBe('true');
    await userEvent.keyboard('{Home}');
    expect(
      screen.getByRole('tab', { name: '詳細' }).getAttribute('aria-selected'),
    ).toBe('true');
  });
});
