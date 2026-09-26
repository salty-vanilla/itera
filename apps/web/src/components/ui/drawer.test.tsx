import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './button';
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './drawer';

afterEach(cleanup);

function renderDrawer(modal = false) {
  render(
    <>
      <Drawer modal={modal}>
        <DrawerTrigger render={<Button />}>詳細を開く</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>タスクの詳細</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <label>
              タイトル
              <input defaultValue="章立てを決める" />
            </label>
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose render={<Button variant="quiet" />}>
              キャンセル
            </DrawerClose>
            <Button>保存</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <button type="button">一覧の行</button>
    </>,
  );
  return screen.getByRole('button', { name: '詳細を開く' });
}

describe('Drawer', () => {
  it('is non-modal by default: no scrim and focus on the first input', async () => {
    const trigger = renderDrawer();
    await userEvent.click(trigger);
    const drawer = await screen.findByRole('dialog', { name: 'タスクの詳細' });
    expect(drawer.getAttribute('aria-modal')).not.toBe('true');
    expect(document.querySelector('[data-slot="drawer-backdrop"]')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('textbox', { name: 'タイトル' }),
      ),
    );
    // The list behind stays usable and the Drawer stays open.
    await userEvent.click(screen.getByRole('button', { name: '一覧の行' }));
    expect(screen.getByRole('dialog', { name: 'タスクの詳細' })).toBeTruthy();
  });

  it('closes with Esc and returns focus to the trigger', async () => {
    const trigger = renderDrawer();
    await userEvent.click(trigger);
    await screen.findByRole('dialog', { name: 'タスクの詳細' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('adds the scrim when modal', async () => {
    const trigger = renderDrawer(true);
    await userEvent.click(trigger);
    const drawer = await screen.findByRole('dialog', { name: 'タスクの詳細' });
    expect(drawer.getAttribute('aria-modal')).toBe('true');
    expect(
      document.querySelector('[data-slot="drawer-backdrop"]'),
    ).not.toBeNull();
  });

  it('closes with the labelled close button', async () => {
    const trigger = renderDrawer();
    await userEvent.click(trigger);
    await userEvent.click(
      await screen.findByRole('button', { name: '閉じる' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});
