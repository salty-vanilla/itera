import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Filter, FilterGroup } from './filter';

afterEach(cleanup);

function Example() {
  const [pressed, setPressed] = useState(false);
  return (
    <FilterGroup label="領域で絞り込む">
      <Filter
        area={{ name: '研究', color: 2 }}
        count={5}
        pressed={pressed}
        onPressedChange={setPressed}
      >
        研究
      </Filter>
      <Filter area={{ name: '学習', color: 3 }} count={0} pressed={false}>
        学習
      </Filter>
    </FilterGroup>
  );
}

describe('Filter', () => {
  it('toggles aria-pressed and reads the name and count', async () => {
    render(<Example />);
    expect(screen.getByRole('group', { name: '領域で絞り込む' })).toBeTruthy();
    const filter = screen.getByRole('button', { name: /^研究\s?5件$/ });
    expect(filter.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(filter);
    expect(filter.getAttribute('aria-pressed')).toBe('true');
    await userEvent.keyboard('{Enter}');
    expect(filter.getAttribute('aria-pressed')).toBe('false');
  });

  it('does not read the Area symbol twice', () => {
    render(<Example />);
    const symbol = screen.getByText('研', { exact: true });
    expect(symbol.getAttribute('aria-hidden')).toBe('true');
  });

  it('is disabled but focusable with 0 items', async () => {
    render(<Example />);
    const empty = screen.getByRole('button', { name: /^学習\s?0件$/ });
    expect(empty.getAttribute('aria-disabled')).toBe('true');
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(empty);
    await userEvent.click(empty);
    expect(empty.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('Filter with 0 items', () => {
  it('stays removable while selected', async () => {
    let pressed = true;
    render(
      <Filter count={0} pressed onPressedChange={(value) => (pressed = value)}>
        期限超過
      </Filter>,
    );
    const filter = screen.getByRole('button', { name: /^期限超過\s?0件$/ });
    expect(filter.getAttribute('aria-disabled')).not.toBe('true');
    await userEvent.click(filter);
    expect(pressed).toBe(false);
  });
});
