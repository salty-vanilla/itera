import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHours } from '@/test/duration';
import { InterruptSheet } from './interrupt-sheet';

afterEach(cleanup);

type Note = { text: string; minutes?: number; time: string; etag: string };

// The note being edited is read again (rerender) while the sheet is open: the
// fields show the note as it is now until they are typed in, and 保存 on a
// note nothing was typed in sends nothing (#324).
function setup(note: Note) {
  const onSubmit = vi.fn(() => true);
  const onOpenChange = vi.fn();
  const sheet = (editing: Note) => (
    <InterruptSheet
      open
      onOpenChange={onOpenChange}
      editing={editing}
      onSubmit={onSubmit}
    />
  );
  const view = render(sheet(note));
  return {
    onSubmit,
    onOpenChange,
    reread: (next: Note) => view.rerender(sheet(next)),
  };
}

const memo = () =>
  screen.getByRole('textbox', { name: /メモ/ }) as HTMLInputElement;
const save = () => screen.getByRole('button', { name: '保存' });

describe('InterruptSheet when another device has changed the note (#324)', () => {
  it("sends nothing on 保存 for a note opened and not typed in, and shows the other device's note", async () => {
    const { onSubmit, onOpenChange, reread } = setup({
      text: '来客',
      minutes: 30,
      time: '10:00',
      etag: '"1"',
    });
    reread({ text: '急な電話', minutes: 45, time: '10:00', etag: '"2"' });
    expect(memo().value).toBe('急な電話');
    expect(
      getHours(within(screen.getByRole('dialog')), /かかった時間/).value,
    ).toBe('');
    await userEvent.click(save());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps what is being typed when the note is read again, and sends it', async () => {
    const { onSubmit, reread } = setup({
      text: '来客',
      minutes: 30,
      time: '10:00',
      etag: '"1"',
    });
    await userEvent.type(memo(), 'の対応');
    reread({ text: '急な電話', minutes: 30, time: '10:00', etag: '"2"' });
    expect(memo().value).toBe('来客の対応');
    await userEvent.click(save());
    // Made from the note as it was when it was typed in (#321): the API
    // tells that another device has changed it since.
    expect(onSubmit).toHaveBeenCalledWith('来客の対応', 30, { etag: '"1"' });
  });

  it('sends a note typed in, as it did', async () => {
    const { onSubmit } = setup({
      text: '来客',
      minutes: 30,
      time: '10:00',
      etag: '"1"',
    });
    await userEvent.clear(memo());
    await userEvent.type(memo(), '障害対応');
    await userEvent.click(save());
    expect(onSubmit).toHaveBeenCalledWith('障害対応', 30, { etag: '"1"' });
  });
});
