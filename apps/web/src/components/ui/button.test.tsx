import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './button';

afterEach(cleanup);

describe('Button', () => {
  it('is a secondary button of type="button" by default', () => {
    render(<Button>差分を確認</Button>);
    const button = screen.getByRole('button', { name: '差分を確認' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.className).toContain('border-border-strong');
  });

  it('is a plain action without pressed, and an inverted toggle while on', () => {
    const { rerender } = render(
      <Button variant="quiet">振り返りに使う</Button>,
    );
    const button = screen.getByRole('button', { name: '振り返りに使う' });
    expect(button.hasAttribute('aria-pressed')).toBe(false);
    rerender(
      <Button variant="quiet" pressed={false}>
        振り返りに使う
      </Button>,
    );
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.className).not.toContain('bg-primary');
    rerender(
      <Button variant="quiet" pressed>
        振り返りに使う
      </Button>,
    );
    expect(button.getAttribute('aria-pressed')).toBe('true');
    // The ink fill and its own hover win over the quiet ones (DESIGN.md
    // Selected).
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('hover:bg-primary-hover');
    expect(button.className).not.toContain('hover:bg-surface-hover');
  });

  it('stays focusable when disabled and ignores presses', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Sprint を確定
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Sprint を確定' });
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('announces the loading label, keeps focus and ignores presses', async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button loading={false} loadingLabel="確定中…" onClick={onClick}>
        Sprint を確定
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Sprint を確定' })).toBeTruthy();

    rerender(
      <Button loading loadingLabel="確定中…" onClick={onClick}>
        Sprint を確定
      </Button>,
    );
    const button = screen.getByRole('button', { name: '確定中…' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    // Loading keeps the variant's colors; only disabled turns grey.
    expect(button.hasAttribute('data-disabled')).toBe(false);
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>差分を確認</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
