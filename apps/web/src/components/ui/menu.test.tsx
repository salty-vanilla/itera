import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from './menu';

afterEach(cleanup);

function renderMenu(onArchive = () => {}) {
  render(
    <>
      <Menu>
        <MenuTrigger>タスクの操作</MenuTrigger>
        <MenuContent>
          <MenuItem>今日へ</MenuItem>
          <MenuItem disabled>上へ</MenuItem>
          <MenuCheckboxItem defaultChecked>目標に入れる</MenuCheckboxItem>
          <MenuSeparator />
          <MenuItem variant="danger" onClick={onArchive}>
            アーカイブ
          </MenuItem>
        </MenuContent>
      </Menu>
      <button type="button">次のボタン</button>
    </>,
  );
  return screen.getByRole('button', { name: 'タスクの操作' });
}

async function openWithKeyboard(trigger: HTMLElement) {
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  return screen.findByRole('menu');
}

describe('Menu', () => {
  it('moves with the arrow keys, Home and End', async () => {
    const trigger = renderMenu();
    await openWithKeyboard(trigger);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('menuitem', { name: '今日へ' }),
      ),
    );
    // A disabled item stays focusable so that it can be read, but does
    // nothing (DESIGN.md common states: Disabled).
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', { name: '上へ' }),
    );
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(
      screen.getByRole('menuitemcheckbox', { name: '目標に入れる' }),
    );
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', { name: 'アーカイブ' }),
    );
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', { name: '今日へ' }),
    );
  });

  it('runs the item with Enter and returns focus to the trigger', async () => {
    const onArchive = vi.fn();
    const trigger = renderMenu(onArchive);
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{End}{Enter}');
    expect(onArchive).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('closes with Esc and returns focus to the trigger', async () => {
    const trigger = renderMenu();
    await openWithKeyboard(trigger);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('closes with Tab', async () => {
    const trigger = renderMenu();
    await openWithKeyboard(trigger);
    await userEvent.tab();
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('marks states with ARIA: checked, disabled, separator', async () => {
    const trigger = renderMenu();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    await openWithKeyboard(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const checkbox = screen.getByRole('menuitemcheckbox');
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(checkbox);
    // A checkbox item stays open so several can be toggled.
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    expect(
      screen
        .getByRole('menuitem', { name: '上へ' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(screen.getByRole('separator')).toBeTruthy();
  });

  it('closes after choosing a radio item', async () => {
    const onValueChange = vi.fn();
    render(
      <Menu>
        <MenuTrigger>並び順</MenuTrigger>
        <MenuContent>
          <MenuRadioGroup value="deadline" onValueChange={onValueChange}>
            <MenuRadioItem value="deadline">期限</MenuRadioItem>
            <MenuRadioItem value="priority">優先度</MenuRadioItem>
          </MenuRadioGroup>
        </MenuContent>
      </Menu>,
    );
    const trigger = screen.getByRole('button', { name: '並び順' });
    await openWithKeyboard(trigger);
    expect(
      screen
        .getByRole('menuitemradio', { name: '期限' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(onValueChange.mock.calls[0]?.[0]).toBe('priority');
  });
});
