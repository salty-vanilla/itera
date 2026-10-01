import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import {
  TOAST_ACTION_TIMEOUT,
  TOAST_TIMEOUT,
  ToastProvider,
  useCloseToastsOnLeave,
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

  it('stays while focus is inside it', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger options={{ title: '3件を今週に入れました' }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '出す' }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    // F6 moves focus to the Toasts, as a keyboard user would.
    fireEvent.keyDown(window, { key: 'F6' });
    expect(
      screen
        .getByRole('region', { name: '通知' })
        .contains(document.activeElement),
    ).toBe(true);
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

  it('replaces a Toast of the same kind instead of stacking it', async () => {
    const undoFirst = vi.fn();
    const undoLast = vi.fn();
    const user = userEvent.setup();
    function Picker() {
      const toast = useToast();
      return (
        <>
          <Button
            onClick={() =>
              toast.show({
                kind: 'sprint-pick',
                title: '「A」を今週に入れました',
                action: { label: '元に戻す', onClick: undoFirst },
              })
            }
          >
            A
          </Button>
          <Button
            onClick={() =>
              toast.show({
                kind: 'sprint-pick',
                title: '「B」を今週に入れました',
                action: { label: '元に戻す', onClick: undoLast },
              })
            }
          >
            B
          </Button>
          <Button
            onClick={() =>
              toast.show({ kind: 'task-added', title: '「C」を追加しました' })
            }
          >
            C
          </Button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Picker />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'A' }));
    await user.click(screen.getByRole('button', { name: 'B' }));
    await user.click(screen.getByRole('button', { name: 'A' }));
    await user.click(screen.getByRole('button', { name: 'B' }));
    expect(visibleToasts()).toHaveLength(1);
    expect(screen.queryByText('「A」を今週に入れました')).toBeNull();
    // Another kind stays beside it.
    await user.click(screen.getByRole('button', { name: 'C' }));
    expect(visibleToasts()).toHaveLength(2);
    // 「元に戻す」 acts on the latest operation.
    await user.click(screen.getByRole('button', { name: '元に戻す' }));
    expect(undoLast).toHaveBeenCalledOnce();
    expect(undoFirst).not.toHaveBeenCalled();
    // After it closed, the same kind shows again.
    await user.click(screen.getByRole('button', { name: 'A' }));
    expect(screen.getByText('「A」を今週に入れました')).not.toBeNull();
  });

  it('restarts the timer when a Toast of the same kind replaces it', async () => {
    vi.useFakeTimers();
    function Twice() {
      const toast = useToast();
      return (
        <Button
          onClick={() =>
            toast.show({ kind: 'task-added', title: '入れました' })
          }
        >
          出す
        </Button>
      );
    }
    render(
      <ToastProvider>
        <Twice />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '出す' }));
    await act(() => vi.advanceTimersByTimeAsync(TOAST_TIMEOUT - 1000));
    fireEvent.click(screen.getByRole('button', { name: '出す' }));
    await act(() => vi.advanceTimersByTimeAsync(TOAST_TIMEOUT - 1000));
    expect(visibleToasts()).toHaveLength(1);
  });

  it('puts the replacing Toast at the newest place, and shows it past the limit', async () => {
    const user = userEvent.setup();
    const kinds = [
      'sprint-pick',
      'task-added',
      'task-archived',
      'day-record-undone',
    ] as const;
    function Kinds() {
      const toast = useToast();
      return (
        <>
          {kinds.map((kind) => (
            <Button
              key={kind}
              onClick={() => toast.show({ kind, title: kind })}
            >
              {kind}
            </Button>
          ))}
        </>
      );
    }
    render(
      <ToastProvider>
        <Kinds />
      </ToastProvider>,
    );
    // The first kind is pushed past the limit by three others...
    for (const kind of kinds)
      await user.click(screen.getByRole('button', { name: kind }));
    expect(visibleToasts()).toHaveLength(3);
    // ...and shown again by its own kind, as the newest (first in the DOM:
    // the list is newest at the bottom).
    await user.click(screen.getByRole('button', { name: 'sprint-pick' }));
    expect(visibleToasts()).toHaveLength(3);
    expect(visibleToasts()[0]?.textContent).toContain('sprint-pick');
    expect(
      document.querySelectorAll('[data-slot="toast"]:not([data-ending-style])'),
    ).toHaveLength(4);
  });

  it('announces a Toast politely in the 通知 region, named by its sentence', async () => {
    const { show } = setup({ title: '「本棚を整理する」を見送りました' });
    await show();
    // The viewport is a polite live region (the role="status" of
    // accessibility.md): a Toast added to it is read out once (#153).
    const region = screen.getByRole('region', { name: '通知' });
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(
      await within(region).findByRole('dialog', {
        name: '「本棚を整理する」を見送りました',
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
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

describe('Toast with an action (#170)', () => {
  it('stays twice as long, and a Toast without one still closes after 8 seconds', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger
          options={{
            title: '「本棚を整理する」を今日やるに入れました',
            action: { label: '今日を開く', onClick: () => {} },
          }}
        />
        <Trigger options={{ title: '3件を今週に入れました' }} />
      </ToastProvider>,
    );
    for (const button of screen.getAllByRole('button', { name: '出す' })) {
      fireEvent.click(button);
    }
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(visibleToasts()).toHaveLength(2);
    await act(() => vi.advanceTimersByTimeAsync(TOAST_TIMEOUT + 500));
    expect(screen.queryByText('3件を今週に入れました')).toBeNull();
    expect(screen.queryByText(/今日やるに入れました/)).not.toBeNull();
    await act(() =>
      vi.advanceTimersByTimeAsync(TOAST_ACTION_TIMEOUT - TOAST_TIMEOUT),
    );
    expect(screen.queryByText(/今日やるに入れました/)).toBeNull();
  });

  it('closing for a screen change keeps a failure and its 再試行', async () => {
    function Leave() {
      const leave = useCloseToastsOnLeave();
      return <Button onClick={leave}>移る</Button>;
    }
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger options={{ title: '結果' }} />
        <Trigger
          options={{
            tone: 'danger',
            title: '保存できませんでした',
            action: { label: '再試行', onClick: () => {} },
          }}
        />
        <Leave />
      </ToastProvider>,
    );
    for (const button of screen.getAllByRole('button', { name: '出す' })) {
      await user.click(button);
    }
    await user.click(screen.getByRole('button', { name: '移る' }));
    await waitFor(() => expect(screen.queryByText('結果')).toBeNull());
    expect(
      screen.queryAllByText('保存できませんでした').length,
    ).toBeGreaterThan(0);
  });
});
