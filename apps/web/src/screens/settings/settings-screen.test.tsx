import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '@/app/router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MOCK_EMAIL } from '@/mock/mock-auth';

afterEach(cleanup);
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  // jsdom has no element scrolling; the Toast makes room by scrolling main.
  Element.prototype.scrollTo ??= () => {};
});

function renderSettings() {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: ['/settings'] }),
  });
  render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
  return router;
}

describe('the settings screen', () => {
  it('shows who is signed in and the passkeys', async () => {
    renderSettings();
    expect(
      await screen.findByRole('heading', { level: 1, name: '設定' }),
    ).toBeTruthy();
    expect(await screen.findByText(`サインイン中：${MOCK_EMAIL}`)).toBeTruthy();
    const list = await screen.findByRole('list', { name: 'パスキー' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list.textContent).toMatch(/^\d+\/\d+ \(.\) に追加$/);
    // The navigation marks where the person is.
    const [current] = screen.getAllByRole('link', { current: 'page' });
    expect(current?.textContent).toBe('設定');
  });

  it('adds a passkey', async () => {
    renderSettings();
    await screen.findByRole('list', { name: 'パスキー' });
    await userEvent.click(
      screen.getByRole('button', { name: 'パスキーを追加' }),
    );
    expect(await screen.findByText('パスキーを追加しました')).toBeTruthy();
    expect(
      await within(
        screen.getByRole('list', { name: 'パスキー' }),
      ).findAllByRole('listitem'),
    ).toHaveLength(2);
  });
});
