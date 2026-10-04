import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHours } from '@/test/duration';
import { AvailableHoursField } from './capacity-indicator';

afterEach(cleanup);

// What the screen reads is read again (rerender): the field shows the value
// as it is now until it is typed in, and leaving it unedited saves nothing
// (#324).
function setup(value: number | undefined) {
  const onChange = vi.fn(() => true);
  const view = render(
    <AvailableHoursField value={value} etag='"1"' onChange={onChange} />,
  );
  // Another device's save: the Sprint has another version (#321).
  const reread = (next: number | undefined) =>
    view.rerender(
      <AvailableHoursField value={next} etag='"2"' onChange={onChange} />,
    );
  return { onChange, reread };
}

const hours = () => getHours(within(document.body), /使える時間/);

describe('AvailableHoursField when another device has changed the value (#324)', () => {
  it("saves nothing on leaving unedited, and shows the other device's value", async () => {
    const { onChange, reread } = setup(10);
    await userEvent.click(hours());
    reread(12);
    expect(hours().value).toBe('12');
    await userEvent.tab();
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(hours().value).toBe('12');
  });

  it('keeps what is being typed when the value is read again', async () => {
    const { onChange, reread } = setup(10);
    await userEvent.clear(hours());
    await userEvent.type(hours(), '8');
    reread(12);
    expect(hours().value).toBe('8');
    await userEvent.tab();
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(8, { etag: '"1"' });
  });

  it('saves a value typed in, as it did', async () => {
    const { onChange } = setup(10);
    await userEvent.clear(hours());
    await userEvent.type(hours(), '8');
    await userEvent.tab();
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(8, { etag: '"1"' });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
