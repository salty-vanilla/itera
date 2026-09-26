import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { X } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { IconButton } from './icon-button';

afterEach(cleanup);

describe('IconButton', () => {
  it('uses the label as its accessible name', () => {
    render(<IconButton label="閉じる" icon={<X aria-hidden />} />);
    const button = screen.getByRole('button', { name: '閉じる' });
    expect(button.getAttribute('aria-pressed')).toBeNull();
  });

  it('shows the label in a tooltip on keyboard focus', async () => {
    render(<IconButton label="閉じる" icon={<X aria-hidden />} />);
    await userEvent.tab();
    expect((await screen.findByText('閉じる')).textContent).toBe('閉じる');
  });

  it('exposes the pressed state of a toggle', () => {
    render(
      <IconButton label="詳細パネルを表示" icon={<X aria-hidden />} pressed />,
    );
    const button = screen.getByRole('button', { name: '詳細パネルを表示' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('IconButton loading', () => {
  it('renames itself and ignores presses while loading', async () => {
    let pressed = 0;
    render(
      <IconButton
        label="下書きを保存"
        icon={<X aria-hidden />}
        loading
        loadingLabel="保存中…"
        onClick={() => pressed++}
      />,
    );
    const button = screen.getByRole('button', { name: '保存中…' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(button);
    expect(pressed).toBe(0);
  });

  it('stays focusable when disabled', async () => {
    render(<IconButton label="閉じる" icon={<X aria-hidden />} disabled />);
    await userEvent.tab();
    expect(document.activeElement?.getAttribute('aria-disabled')).toBe('true');
  });
});
