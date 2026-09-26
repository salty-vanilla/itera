import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import {
  TOAST_TIMEOUT,
  ToastProvider,
  useToast,
  type ToastOptions,
} from './toast';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Trigger({ options }: { options: ToastOptions }) {
  const toast = useToast();
  return <Button onClick={() => toast.show(options)}>出す</Button>;
}

function setup(options: ToastOptions) {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <Trigger options={options} />
    </ToastProvider>,
  );
  return {
    user,
    show: () => user.click(screen.getByRole('button', { name: '出す' })),
  };
}

const visibleToasts = () =>
  [...document.querySelectorAll('[data-slot="toast"]')].filter(
    (toast) => !toast.hasAttribute('data-limited'),
  );

describe('Toast', () => {
  it('closes after 8 seconds', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger
          options={{ title: 'Sprint 14 を確定しました', tone: 'done' }}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '出す' }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(visibleToasts()).toHaveLength(1);
    await act(() => vi.advanceTimersByTimeAsync(TOAST_TIMEOUT - 100));
    expect(screen.queryByText('Sprint 14 を確定しました')).not.toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(
      visibleToasts().filter((t) => !t.hasAttribute('data-ending-style')),
    ).toHaveLength(0);
  });

  it('stays while the pointer is over it', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger options={{ title: '3件を今週に入れました' }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '出す' }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    fireEvent.mouseEnter(screen.getByRole('region', { name: '通知' }));
    await act(() => vi.advanceTimersByTimeAsync(TOAST_TIMEOUT * 2));
    expect(visibleToasts()).toHaveLength(1);
  });

  it('keeps a danger Toast until it is closed', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger options={{ tone: 'danger', title: '保存できませんでした' }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '出す' }));
    await act(() => vi.advanceTimersByTimeAsync(TOAST_TIMEOUT * 2));
    expect(visibleToasts()).toHaveLength(1);
  });

  it('shows three at a time at most', async () => {
    const { show } = setup({ title: '3件を今週に入れました' });
    for (let i = 0; i < 4; i++) await show();
    expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(4);
    expect(visibleToasts()).toHaveLength(3);
  });

  it('announces danger with role="alert"', async () => {
    const { show } = setup({
      tone: 'danger',
      title: '保存できませんでした',
      description: '入力内容は残っています。',
    });
    await show();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('保存できませんでした');
    expect(alert.textContent).toContain('入力内容は残っています。');
  });

  it('runs the action and closes', async () => {
    const undo = vi.fn();
    const { user, show } = setup({
      title: '3件を今週に入れました',
      action: { label: '元に戻す', onClick: undo },
    });
    await show();
    await user.click(screen.getByRole('button', { name: '元に戻す' }));
    expect(undo).toHaveBeenCalledOnce();
    expect(
      document.querySelector('[data-slot="toast"]:not([data-ending-style])'),
    ).toBeNull();
  });

  it('can be closed with its close button', async () => {
    const { user, show } = setup({ title: '3件を今週に入れました' });
    await show();
    await user.click(screen.getByRole('button', { name: '閉じる' }));
    expect(
      document.querySelector('[data-slot="toast"]:not([data-ending-style])'),
    ).toBeNull();
  });
});
