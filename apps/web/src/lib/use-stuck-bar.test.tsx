import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useStuckBar } from './use-stuck-bar';

afterEach(cleanup);

const value = (name: string) =>
  document.documentElement.style.getPropertyValue(name);

function Bar({ edge, active }: { edge: 'top' | 'bottom'; active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useStuckBar(ref, edge, active);
  return <div ref={ref} />;
}

describe('useStuckBar (#152)', () => {
  it('publishes a bottom bar for the scroll padding and the Toast, and removes it when the bar goes', () => {
    const { unmount } = render(<Bar edge="bottom" />);
    expect(value('--stuck-bar-bottom')).toBe('0px');
    expect(value('--toast-offset-above')).toBe('0px');
    expect(value('--stuck-bar-top')).toBe('');
    unmount();
    expect(value('--stuck-bar-bottom')).toBe('');
    expect(value('--toast-offset-above')).toBe('');
  });

  it('publishes a top bar for the scroll padding only', () => {
    const { unmount } = render(<Bar edge="top" />);
    expect(value('--stuck-bar-top')).toBe('0px');
    expect(value('--stuck-bar-bottom')).toBe('');
    expect(value('--toast-offset-above')).toBe('');
    unmount();
    expect(value('--stuck-bar-top')).toBe('');
  });

  it('publishes nothing while the bar does not stick', () => {
    const { rerender } = render(<Bar edge="bottom" active={false} />);
    expect(value('--stuck-bar-bottom')).toBe('');
    rerender(<Bar edge="bottom" active />);
    expect(value('--stuck-bar-bottom')).toBe('0px');
    rerender(<Bar edge="bottom" active={false} />);
    expect(value('--stuck-bar-bottom')).toBe('');
  });
});
