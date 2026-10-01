import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFocusedRowInView } from './use-focused-row-in-view';

// jsdom has no scrollIntoView: each test puts a mock in its place.
const original = Element.prototype.scrollIntoView;
afterEach(() => {
  cleanup();
  Element.prototype.scrollIntoView = original;
});

function Screen() {
  const ref = useRef<HTMLElement>(null);
  useFocusedRowInView(ref);
  return (
    <main ref={ref}>
      <button type="button">前</button>
      <div data-slot="task-row" data-testid="row">
        <button type="button" data-row-focus>
          実験データの前処理
        </button>
        <button type="button">操作</button>
      </div>
    </main>
  );
}

describe('useFocusedRowInView (#152)', () => {
  it('scrolls the whole row in when its title takes the focus by the keyboard', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    render(<Screen />);
    await userEvent.tab();
    expect(scrolled).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect(scrolled.mock.contexts[0]).toBe(screen.getByTestId('row'));
    expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' });
    // Other controls of the row are scrolled in by the browser alone.
    await userEvent.tab();
    expect(scrolled).toHaveBeenCalledTimes(1);
  });

  it('leaves the row where it is when the title is clicked', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    render(<Screen />);
    await userEvent.click(screen.getByText('実験データの前処理'));
    expect(scrolled).not.toHaveBeenCalled();
  });
});
