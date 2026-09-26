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
