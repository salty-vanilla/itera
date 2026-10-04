import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoalBlock } from './goal-block';

afterEach(cleanup);

// What the screen reads is read again (rerender) while the form is open: the
// form shows the Goal as it is now until it is typed in, and 保存 on a form
// nothing was typed in saves nothing (#324).
function setup(goal: string | undefined) {
  const onSave = vi.fn(() => true);
  const props = {
    area: { name: '研究', color: 2 as const },
    week: '今週',
    onSave,
  };
  // The Goal's etag: "1" as opened, "2" once another device has saved it
  // (#321); none without a Goal.
  const etagOf = (text: string | undefined, version: string) =>
    text === undefined ? undefined : version;
  const view = render(
    <GoalBlock {...props} goal={goal} goalEtag={etagOf(goal, '"1"')} />,
  );
  const reread = (next: string | undefined) =>
    view.rerender(
      <GoalBlock {...props} goal={next} goalEtag={etagOf(next, '"2"')} />,
    );
  return { onSave, reread };
}

const field = () => screen.getByRole('textbox') as HTMLTextAreaElement;

describe('GoalBlock when another device has written the Goal (#324)', () => {
  it("saves nothing on 保存 for a Goal opened and not typed in, and shows the other device's Goal", async () => {
    const { onSave, reread } = setup('先行研究を押さえる');
    await userEvent.click(
      screen.getByRole('button', { name: '目標を編集：研究' }),
    );
    reread('先行研究を 2本押さえる');
    expect(field().value).toBe('先行研究を 2本押さえる');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('先行研究を 2本押さえる')).toBeTruthy();
  });

  it('does not remove a Goal another device wrote while an empty form was open', async () => {
    const { onSave, reread } = setup(undefined);
    await userEvent.click(
      screen.getByRole('button', { name: '目標を書く：研究' }),
    );
    reread('スマホで書いた目標');
    expect(field().value).toBe('スマホで書いた目標');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('スマホで書いた目標')).toBeTruthy();
  });

  it('keeps what is being typed when the Goal is read again', async () => {
    const { onSave, reread } = setup('先行研究を押さえる');
    await userEvent.click(
      screen.getByRole('button', { name: '目標を編集：研究' }),
    );
    await userEvent.type(field(), 'の続き');
    reread('スマホで直した目標');
    expect(field().value).toBe('先行研究を押さえるの続き');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    // Made from the Goal as it was typed in: the API tells it has changed.
    expect(onSave).toHaveBeenCalledWith('先行研究を押さえるの続き', {
      etag: '"1"',
    });
  });

  it('makes a Goal from none in an Area without one (#321)', async () => {
    const { onSave } = setup(undefined);
    await userEvent.click(
      screen.getByRole('button', { name: '目標を書く：研究' }),
    );
    await userEvent.type(field(), '発表を終える');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).toHaveBeenCalledWith('発表を終える', { none: true });
  });

  it('saves a Goal typed in, as it did', async () => {
    const { onSave } = setup('先行研究を押さえる');
    await userEvent.click(
      screen.getByRole('button', { name: '目標を編集：研究' }),
    );
    await userEvent.clear(field());
    await userEvent.type(field(), '先行研究を終える');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).toHaveBeenCalledWith('先行研究を終える', { etag: '"1"' });
  });
});
