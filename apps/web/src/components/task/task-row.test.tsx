import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskRow } from './task-row';

afterEach(cleanup);

const spacer = (container: HTMLElement) =>
  container.querySelector('[data-slot="task-row"] > div[aria-hidden]');

describe('TaskRow reserveActions', () => {
  it('keeps the width of the actions when the row has none', () => {
    const { container } = render(
      <TaskRow title="部屋の掃除" estimate="1時間" reserveActions />,
    );
    expect(spacer(container)).not.toBeNull();
  });

  it('adds nothing by default or when the row has actions', () => {
    const plain = render(<TaskRow title="部屋の掃除" estimate="1時間" />);
    expect(spacer(plain.container)).toBeNull();
    cleanup();
    const withActions = render(
      <TaskRow
        title="部屋の掃除"
        estimate="1時間"
        actions={<button>操作</button>}
        reserveActions
      />,
    );
    expect(spacer(withActions.container)).toBeNull();
  });
});

describe('TaskRow actionsVisible', () => {
  const slot = (container: HTMLElement) =>
    container.querySelector('button')?.parentElement;

  it('hides the actions until hover or focus from 768px by default', () => {
    const { container } = render(
      <TaskRow title="部屋の掃除" actions={<button>操作</button>} />,
    );
    expect(slot(container)?.className).toContain('medium:opacity-0');
  });

  it('shows them at every width when asked', () => {
    const { container } = render(
      <TaskRow
        title="部屋の掃除"
        actions={<button>取り消す</button>}
        actionsVisible
      />,
    );
    expect(slot(container)?.className).not.toContain('opacity-0');
  });
});

describe('TaskRow — the focus ring round the row (#152)', () => {
  // jsdom has no scrollIntoView: each test puts a mock in its place.
  const original = Element.prototype.scrollIntoView;
  afterEach(() => {
    Element.prototype.scrollIntoView = original;
  });

  const row = () => (
    <>
      <button type="button">前</button>
      <TaskRow
        title="実験データの前処理"
        onOpen={() => {}}
        actions={<button type="button">操作</button>}
      />
    </>
  );

  it('scrolls the whole row in when its title takes the focus by the keyboard', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    const { container } = render(row());
    await userEvent.tab();
    expect(scrolled).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect(scrolled.mock.contexts[0]).toBe(
      container.querySelector('[data-slot="task-row"]'),
    );
    expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' });
    // Other controls of the row are scrolled in by the browser alone.
    await userEvent.tab();
    expect(scrolled).toHaveBeenCalledTimes(1);
  });

  it('leaves the row where it is when the title is clicked', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    render(row());
    await userEvent.click(screen.getByText('実験データの前処理'));
    expect(scrolled).not.toHaveBeenCalled();
  });
});
