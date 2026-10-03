import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_DURATION, type DurationText } from '@/lib/duration-text';
import { DurationField } from './duration-field';

afterEach(cleanup);

function describedBy(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);
}

function Harness({
  initial = EMPTY_DURATION,
  onCommit,
  error,
}: {
  initial?: DurationText;
  onCommit?: (value: DurationText) => void;
  error?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DurationField
        label="見積もり"
        necessity="optional"
        description="あとから追加もできます"
        error={error}
        value={value}
        onChange={setValue}
        onCommit={onCommit}
      />
      <button type="button">ほか</button>
    </>
  );
}

const fields = () => {
  const group = screen.getByRole('group', { name: '見積もり任意' });
  return {
    hours: within(group).getByRole<HTMLInputElement>('textbox', {
      name: '時間',
    }),
    minutes: within(group).getByRole<HTMLInputElement>('textbox', {
      name: '分',
    }),
  };
};

describe('DurationField', () => {
  it('is one group named by the label, with the fields 時間 and 分', () => {
    render(<Harness initial={{ hours: '1', minutes: '30' }} />);
    const { hours, minutes } = fields();
    expect(hours.value).toBe('1');
    expect(minutes.value).toBe('30');
    expect(hours.inputMode).toBe('numeric');
    expect(minutes.inputMode).toBe('numeric');
    expect(hours.getAttribute('enterkeyhint')).toBe('next');
  });

  it('ties the support text and the error to both fields', () => {
    render(<Harness error="1分以上の時間を数字で入れてください" />);
    for (const input of Object.values(fields())) {
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(describedBy(input)).toEqual([
        'あとから追加もできます',
        '1分以上の時間を数字で入れてください',
      ]);
    }
  });

  it('saves on leaving both fields, not on going from 時間 to 分', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const { hours, minutes } = fields();
    await userEvent.type(hours, '1');
    await userEvent.tab();
    expect(document.activeElement).toBe(minutes);
    expect(onCommit).not.toHaveBeenCalled();
    await userEvent.type(minutes, '30');
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith({ hours: '1', minutes: '30' });
  });

  it('writes back on leaving what was typed, as the screen writes it', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const { hours, minutes } = fields();
    await userEvent.type(minutes, '90');
    await userEvent.tab();
    expect(hours.value).toBe('1');
    expect(minutes.value).toBe('30');
    expect(onCommit).toHaveBeenLastCalledWith({ hours: '1', minutes: '30' });

    await userEvent.clear(hours);
    await userEvent.clear(minutes);
    await userEvent.type(hours, '2.25');
    await userEvent.tab();
    await userEvent.tab();
    expect(hours.value).toBe('2');
    expect(minutes.value).toBe('15');
  });

  it('keeps what cannot be read as typed', async () => {
    render(<Harness />);
    const { hours } = fields();
    await userEvent.type(hours, 'abc');
    await userEvent.tab();
    await userEvent.tab();
    expect(hours.value).toBe('abc');
  });

  it('goes from 時間 to 分 on Enter, and saves on Enter in 分', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const { hours, minutes } = fields();
    await userEvent.type(hours, '3{Enter}');
    expect(document.activeElement).toBe(minutes);
    expect(onCommit).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(onCommit).toHaveBeenLastCalledWith({ hours: '3', minutes: '' });
  });

  it('leaves Enter in 分 to the form when it saves with a button', async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Harness />
        <button type="submit">記録する</button>
      </form>,
    );
    const { hours } = fields();
    await userEvent.type(hours, '1{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
