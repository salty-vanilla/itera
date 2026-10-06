import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AreaMark } from './area-indicator';
import { Field } from './field';
import { Select } from './select';

afterEach(cleanup);

function paddingLeft(select: HTMLElement) {
  return select.className.split(' ').filter((c) => /(^|:)pl-/.test(c));
}

describe('Select prefix room (#448)', () => {
  it('keeps room for the mark in the mark’s own terms, not in px steps by width', () => {
    render(
      <Field label="領域" hideLabel>
        <Select prefix={<AreaMark name="研究" color={2} />}>
          <option>研究</option>
        </Select>
      </Field>,
    );
    // One rule for every width: 8px + the mark (--area-mark-size, which
    // AreaMark is also sized by) + 4px. A step on `enlarged:` (a width) is what
    // let the value run under the mark at 32px text on a wide screen.
    expect(paddingLeft(screen.getByRole('combobox'))).toEqual([
      'pl-[calc(var(--spacing-2)+var(--area-mark-size)+var(--spacing-1))]',
    ]);
  });

  it('has the plain room without a prefix', () => {
    render(
      <Field label="領域" hideLabel>
        <Select size="sm">
          <option>研究</option>
        </Select>
      </Field>,
    );
    expect(paddingLeft(screen.getByRole('combobox'))).toEqual([
      'pl-3',
      'medium:pl-2',
    ]);
  });
});
