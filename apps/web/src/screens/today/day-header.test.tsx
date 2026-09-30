import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '@/app/router';
import { TooltipProvider } from '@/components/ui/tooltip';

// The Today screen's heading (#90): the days before and after by the
// arrows, a date to choose, and back to today from the navigation.

afterEach(cleanup);
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

async function renderAt(url: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return router;
}

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;
const dateInput = () => screen.getByLabelText<HTMLInputElement>('日付を選ぶ');

describe('Today — the heading’s days (#90)', () => {
  it('steps a day at a time, and back to today with no date', async () => {
    const router = await renderAt('/today?fixture=today-daytime');
    await userEvent.click(
      screen.getByRole('link', { name: '前の日（9/30 (水)）' }),
    );
    await waitFor(() => expect(heading()).toBe('9月30日（水）'));
    expect(router.state.location.search).toEqual({
      fixture: 'today-daytime',
      date: '2026-09-30',
    });
    await userEvent.click(
      screen.getByRole('link', { name: '次の日（10/1 (木)）' }),
    );
    await waitFor(() => expect(heading()).toBe('10月1日（木）'));
    expect(router.state.location.search).toEqual({ fixture: 'today-daytime' });
  });

  it('keeps focus on the arrow when the day changes under it', async () => {
    await renderAt('/today?fixture=today-daytime');
    // Today to another day, and back: the screen under the heading changes.
    await userEvent.click(
      screen.getByRole('link', { name: '前の日（9/30 (水)）' }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('link', { name: '前の日（9/29 (火)）' }),
      ),
    );
    await userEvent.click(
      screen.getByRole('link', { name: '次の日（10/1 (木)）' }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('link', { name: '次の日（10/2 (金)）' }),
      ),
    );
  });

  it('opens a date from the picker at once, and the navigation comes back to today', async () => {
    const router = await renderAt('/today?fixture=today-daytime');
    // The picker sets a whole date with no key.
    fireEvent.change(dateInput(), { target: { value: '2026-10-03' } });
    await waitFor(() => expect(heading()).toBe('10月3日（土）'));
    expect(router.state.location.search).toMatchObject({ date: '2026-10-03' });
    expect(document.activeElement).toBe(dateInput());
    // The navigation does not carry the day (#90).
    await userEvent.click(screen.getAllByRole('link', { name: '今日' })[0]!);
    await waitFor(() => expect(heading()).toBe('10月1日（木）'));
    expect(router.state.location.search).toEqual({ fixture: 'today-daytime' });
  });

  it('opens a typed date on Enter or on leaving the field, not field by field', async () => {
    const router = await renderAt('/today?fixture=today-daytime');
    const input = dateInput();
    input.focus();
    // The year typed as 2 → 20 → 202: each a date, none to open.
    for (const value of ['0002-10-03', '0020-10-03', '0202-10-03']) {
      fireEvent.keyDown(input, { key: '2' });
      fireEvent.change(input, { target: { value } });
    }
    expect(heading()).toBe('10月1日（木）');
    fireEvent.keyDown(input, { key: '6' });
    fireEvent.change(input, { target: { value: '2026-10-03' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(heading()).toBe('10月3日（土）'));
    expect(router.history.length).toBe(2);

    fireEvent.keyDown(dateInput(), { key: '5' });
    fireEvent.change(dateInput(), { target: { value: '2026-10-05' } });
    fireEvent.blur(dateInput());
    await waitFor(() => expect(heading()).toBe('10月5日（月）'));
  });

  it('goes back to the day shown when a typed date is left unfinished', async () => {
    await renderAt('/today?fixture=today-daytime&date=2026-09-30');
    fireEvent.keyDown(dateInput(), { key: 'Backspace' });
    fireEvent.change(dateInput(), { target: { value: '' } });
    fireEvent.blur(dateInput());
    expect(dateInput().value).toBe('2026-09-30');
    expect(heading()).toBe('9月30日（水）');
  });
});
