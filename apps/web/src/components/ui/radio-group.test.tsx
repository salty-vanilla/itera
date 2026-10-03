import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Radio, RadioGroup } from './radio-group';

afterEach(cleanup);

function describedBy(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);
}

describe('RadioGroup', () => {
  function SelfAssessment({ error }: { error?: string }) {
    return (
      <RadioGroup
        legend="目標の自己判定"
        description="今週の目標にどこまで近づけたかを選びます。"
        error={error}
      >
        <Radio value="achieved" label="できた" />
        <Radio value="partial" label="一部できた" />
        <Radio value="notAchieved" label="できなかった" />
        <Radio value="noJudgement" label="決めない" />
      </RadioGroup>
    );
  }

  it('is a fieldset named by its legend, with nothing chosen at first', () => {
    render(<SelfAssessment />);
    const group = screen.getByRole('radiogroup', { name: '目標の自己判定' });
    expect(group.tagName).toBe('FIELDSET');
    expect(group.querySelector('legend')?.textContent).toBe('目標の自己判定');
    expect(describedBy(group)).toEqual([
      '今週の目標にどこまで近づけたかを選びます。',
    ]);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.getAttribute('aria-checked')).toBe('false');
    }
  });

  it('chooses with the label and moves with the arrow keys', async () => {
    render(<SelfAssessment />);
    await userEvent.click(screen.getByText('一部できた'));
    const partial = screen.getByRole('radio', { name: '一部できた' });
    expect(partial.getAttribute('aria-checked')).toBe('true');
    await userEvent.keyboard('{ArrowDown}');
    const notAchieved = screen.getByRole('radio', { name: 'できなかった' });
    expect(document.activeElement).toBe(notAchieved);
    expect(notAchieved.getAttribute('aria-checked')).toBe('true');
  });

  it('ties the error to the group', () => {
    render(<SelfAssessment error="どれか 1つを選んでください" />);
    const group = screen.getByRole('radiogroup', { name: '目標の自己判定' });
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(group)).toContain('どれか 1つを選んでください');
  });
});
