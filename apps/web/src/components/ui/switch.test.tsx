import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Switch } from './switch';

afterEach(cleanup);

function describedBy(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);
}

describe('Switch', () => {
  it('is a switch named by its label that says オン / オフ', async () => {
    render(
      <Switch
        label="振り返りの前日に通知"
        description="オンにすると、Sprint の最終日の前日 18:00 に通知します。"
      />,
    );
    const toggle = screen.getByRole('switch', { name: '振り返りの前日に通知' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(describedBy(toggle)).toEqual([
      'オンにすると、Sprint の最終日の前日 18:00 に通知します。',
    ]);
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await userEvent.keyboard(' ');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });
});
