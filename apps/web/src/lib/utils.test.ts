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

  it('treats nowrap-phrase as a white-space class (#433)', () => {
    expect(cn('nowrap-phrase text-ink', 'text-num-s truncate')).toBe(
      'nowrap-phrase text-ink text-num-s truncate',
    );
    expect(cn('whitespace-nowrap', 'nowrap-phrase')).toBe('nowrap-phrase');
    expect(cn('nowrap-phrase', 'whitespace-normal')).toBe('whitespace-normal');
    expect(cn('enlarged:whitespace-nowrap', 'nowrap-phrase')).toBe(
      'enlarged:whitespace-nowrap nowrap-phrase',
    );
  });
});
