import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

afterEach(cleanup);

describe('Tooltip', () => {
  it('opens on focus as role="tooltip" and describes its trigger', async () => {
    render(
      <Tooltip>
        <TooltipTrigger>章立てを決める</TooltipTrigger>
        <TooltipContent>関連研究のメモを整理して章立てを決める</TooltipContent>
      </Tooltip>,
    );
    await userEvent.tab();
    const tooltip = await screen.findByRole('tooltip');
    const trigger = screen.getByRole('button', { name: '章立てを決める' });
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
