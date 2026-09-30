import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { useToastClearance } from './use-toast-clearance';

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--toast-offset-above');
  vi.restoreAllMocks();
});

function rect(top: number, height: number, left = 0, width = 300): DOMRect {
  return {
    top,
    bottom: top + height,
    height,
    left,
    right: left + width,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

function Screen() {
  const ref = useRef<HTMLElement>(null);
  useToastClearance(ref);
  const toast = useToast();
  return (
    <main ref={ref}>
      <div data-slot="task-row">
        <button
          onClick={() =>
            toast.show({ kind: 'task-added', title: '入れました' })
          }
        >
          押す
        </button>
      </div>
    </main>
  );
}

// jsdom has no layout: the boxes are given.
function setup(row: DOMRect, content = rect(0, 0)) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      if (this.matches('[data-slot="toast-viewport"]'))
        return this.childElementCount > 0 ? rect(700, 76) : rect(776, 0);
      if (this.matches('main')) return rect(0, 800);
      if (this.matches('[data-slot="task-row"]')) return row;
      if (this.matches('button')) return content;
      return rect(0, 0);
    },
  );
  render(
    <ToastProvider>
      <Screen />
    </ToastProvider>,
  );
  return userEvent.setup();
}

describe('useToastClearance', () => {
  it('adds room under the screen while a Toast shows, and takes it away', async () => {
    const user = setup(rect(100, 40));
    const main = document.querySelector('main')!;
    const room = () => main.style.getPropertyValue('--toast-clearance');
    expect(room()).toBe('');
    await user.click(screen.getByRole('button', { name: '押す' }));
    // The Toast starts at 700 in a screen that ends at 800.
    expect(room()).toBe('100px');
    await user.click(screen.getByRole('button', { name: '閉じる' }));
    await vi.waitFor(() => expect(room()).toBe(''));
  });

  it('adds no room where the content stands clear of the Toasts sideways', async () => {
    // The Toasts are over x 0 to 300; the button is at 500.
    const user = setup(rect(100, 40), rect(0, 40, 500));
    await user.click(screen.getByRole('button', { name: '押す' }));
    expect(
      document
        .querySelector('main')!
        .style.getPropertyValue('--toast-clearance'),
    ).toBe('');
  });

  it('leaves the room before a stuck bar, where the Toasts are lifted above it', async () => {
    document.documentElement.style.setProperty('--toast-offset-above', '70px');
    const user = setup(rect(100, 40));
    await user.click(screen.getByRole('button', { name: '押す' }));
    const main = document.querySelector('main')!;
    // No padding, which would lift the bar. The Toasts start at 700 in a
    // screen that ends at 800, and the bar takes 70 of it: 30px to leave.
    expect(main.style.getPropertyValue('--toast-clearance')).toBe('');
    expect(main.style.getPropertyValue('--toast-above-room')).toBe('30px');
  });

  it('scrolls a pressed row up when a Toast would cover it', async () => {
    const scrollBy = vi.fn();
    const user = setup(rect(680, 40, 20));
    document.querySelector('main')!.scrollBy = scrollBy;
    await user.click(screen.getByRole('button', { name: '押す' }));
    // 720 (the row's bottom) to 700 (the Toast's top) and a gap of 8.
    expect(scrollBy).toHaveBeenCalledWith({ top: 28 });
  });

  it('leaves a row the Toast does not cover', async () => {
    const scrollBy = vi.fn();
    const user = setup(rect(100, 40, 20));
    document.querySelector('main')!.scrollBy = scrollBy;
    await user.click(screen.getByRole('button', { name: '押す' }));
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
