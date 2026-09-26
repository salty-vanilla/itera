import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('keeps a typography token next to a text color', () => {
    expect(cn('text-body text-ink', 'text-on-primary')).toBe(
      'text-body text-on-primary',
    );
    expect(cn('text-body text-ink', 'text-button')).toBe(
      'text-ink text-button',
    );
  });

  it('replaces elevation and named dimensions', () => {
    expect(cn('shadow-overlay', 'shadow-modal')).toBe('shadow-modal');
    expect(cn('px-3 h-control-md', 'h-control-lg')).toBe('px-3 h-control-lg');
  });
});
