import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskRow } from './task-row';

afterEach(cleanup);

const spacer = (container: HTMLElement) =>
  container.querySelector('[data-slot="task-row"] > div[aria-hidden]');

describe('TaskRow reserveActions', () => {
  it('keeps the width of the actions when the row has none', () => {
    const { container } = render(
      <TaskRow title="部屋の掃除" estimate="1h" reserveActions />,
    );
    expect(spacer(container)).not.toBeNull();
  });

  it('adds nothing by default or when the row has actions', () => {
    const plain = render(<TaskRow title="部屋の掃除" estimate="1h" />);
    expect(spacer(plain.container)).toBeNull();
    cleanup();
    const withActions = render(
      <TaskRow
        title="部屋の掃除"
        estimate="1h"
        actions={<button>操作</button>}
        reserveActions
      />,
    );
    expect(spacer(withActions.container)).toBeNull();
  });
});
