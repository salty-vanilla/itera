import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './button';
import {
  AlertDialog,
  AlertDialogTrigger,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

afterEach(cleanup);

describe('Dialog', () => {
  it('focuses the safe action even with an input, closes with Esc and returns focus', async () => {
    render(
      <Dialog>
        <DialogTrigger render={<Button variant="primary" />}>
          Sprint 14 を確定
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sprint 14 を確定しますか？</DialogTitle>
            <DialogDescription>
              確定すると計画値が固定されます。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button />}>戻って調整</DialogClose>
            <Button variant="primary">Sprint 14 を確定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole('button', { name: 'Sprint 14 を確定' });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', {
      name: 'Sprint 14 を確定しますか？',
    });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: '戻って調整' }),
      ),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('confirms a destructive action as an alertdialog', async () => {
    render(
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="danger" />}>
          アーカイブ
        </AlertDialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>3件のタスクをアーカイブしますか？</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button />}>キャンセル</DialogClose>
            <Button variant="danger-solid">3件をアーカイブ</Button>
          </DialogFooter>
        </DialogContent>
      </AlertDialog>,
    );
    const trigger = screen.getByRole('button', { name: 'アーカイブ' });
    await userEvent.click(trigger);
    await screen.findByRole('alertdialog', {
      name: '3件のタスクをアーカイブしますか？',
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'キャンセル' }),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});
