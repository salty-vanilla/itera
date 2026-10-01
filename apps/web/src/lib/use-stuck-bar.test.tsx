import { cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useStuckBar } from './use-stuck-bar';

afterEach(cleanup);

const value = (name: string) =>
  document.documentElement.style.getPropertyValue(name);

function Bar({ edge, active }: { edge: 'top' | 'bottom'; active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useStuckBar(ref, edge, active);
  return <div ref={ref} data-testid="bar" />;
}

describe('useStuckBar (#152)', () => {
  it('publishes a bottom bar for the scroll margin and the Toast, and removes it when the bar goes', () => {
    const { unmount } = render(<Bar edge="bottom" />);
    // Marked, so that its own controls take no scroll margin (globals.css).
    expect(screen.getByTestId('bar').dataset.stuckBar).toBe('bottom');
    expect(value('--stuck-bar-bottom')).toBe('0px');
    expect(value('--toast-offset-above')).toBe('0px');
    expect(value('--stuck-bar-top')).toBe('');
    unmount();
    expect(value('--stuck-bar-bottom')).toBe('');
    expect(value('--toast-offset-above')).toBe('');
  });

  it('publishes a top bar for the scroll margin only', () => {
    const { unmount } = render(<Bar edge="top" />);
    expect(value('--stuck-bar-top')).toBe('0px');
    expect(value('--stuck-bar-bottom')).toBe('');
    expect(value('--toast-offset-above')).toBe('');
    unmount();
    expect(value('--stuck-bar-top')).toBe('');
  });

  it('publishes nothing while the bar does not stick', () => {
    const { rerender } = render(<Bar edge="bottom" active={false} />);
    const bar = screen.getByTestId('bar');
    expect(value('--stuck-bar-bottom')).toBe('');
    expect(bar.dataset.stuckBar).toBeUndefined();
    rerender(<Bar edge="bottom" active />);
    expect(value('--stuck-bar-bottom')).toBe('0px');
    expect(bar.dataset.stuckBar).toBe('bottom');
    rerender(<Bar edge="bottom" active={false} />);
    expect(value('--stuck-bar-bottom')).toBe('');
    expect(bar.dataset.stuckBar).toBeUndefined();
  });
});
