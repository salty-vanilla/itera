import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Checkbox, CheckboxControl } from './checkbox';

afterEach(cleanup);

function describedBy(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);
}

describe('Checkbox', () => {
  it('toggles from the box, the label and the keyboard', async () => {
    render(<Checkbox label="週の途中の追加も通知する" />);
    const checkbox = screen.getByRole('checkbox', {
      name: '週の途中の追加も通知する',
    });
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(screen.getByText('週の途中の追加も通知する'));
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
    await userEvent.keyboard(' ');
    expect(document.activeElement).toBe(checkbox);
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
  });

  it('reports the mixed state', () => {
    render(<CheckboxControl aria-label="すべて反映する" indeterminate />);
    expect(
      screen
        .getByRole('checkbox', { name: 'すべて反映する' })
        .getAttribute('aria-checked'),
    ).toBe('mixed');
  });

  it('ties the description and the error to the checkbox', () => {
    render(
      <Checkbox
        label="差分を反映する"
        description="反映しても Sprint は確定されません。"
        error="反映する行を 1 つ以上選んでください"
      />,
    );
    const checkbox = screen.getByRole('checkbox', { name: '差分を反映する' });
    expect(checkbox.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(checkbox)).toEqual([
      '反映しても Sprint は確定されません。',
      '反映する行を 1 つ以上選んでください',
    ]);
  });

  it('stays unchecked when disabled', async () => {
    render(<Checkbox label="今週に入れる" disabled />);
    const checkbox = screen.getByRole('checkbox', { name: '今週に入れる' });
    await userEvent.click(checkbox);
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    expect(checkbox.getAttribute('aria-disabled')).toBe('true');
  });
});
