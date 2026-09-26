import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './button';
import {
  Popover,
  PopoverBody,
  PopoverClose,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from './popover';

afterEach(cleanup);

function renderPopover() {
  render(
    <>
      <Popover>
        <PopoverTrigger render={<Button />}>3h</PopoverTrigger>
        <PopoverContent>
          <PopoverHeader>
            <PopoverTitle>Estimate を編集</PopoverTitle>
          </PopoverHeader>
          <PopoverBody>
            <label>
              Estimate
              <input inputMode="decimal" defaultValue="3" />
            </label>
          </PopoverBody>
          <PopoverFooter>
            <PopoverClose render={<Button variant="quiet" />}>
              キャンセル
            </PopoverClose>
            <Button>保存</Button>
          </PopoverFooter>
        </PopoverContent>
      </Popover>
      <button type="button">外側</button>
    </>,
  );
  return screen.getByRole('button', { name: '3h' });
}

describe('Popover', () => {
  it('focuses the first input, not the close button', async () => {
    const trigger = renderPopover();
    await userEvent.click(trigger);
    await screen.findByRole('dialog', { name: 'Estimate を編集' });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('textbox', { name: 'Estimate' }),
      ),
    );
  });

  it('closes with Esc and returns focus to the trigger', async () => {
    const trigger = renderPopover();
    await userEvent.click(trigger);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on an outside click', async () => {
    const trigger = renderPopover();
    await userEvent.click(trigger);
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: '外側' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
