import { cleanup, render, screen } from '@testing-library/react';
import { Calendar, Info } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { Divider, DividerLabel } from './divider';
import { Icon } from './icon';
import { Kbd, KbdGroup } from './kbd';
import { Notice } from './notice';
import { Progress } from './progress';
import { Spinner } from './spinner';
import { Tag } from './tag';

afterEach(cleanup);

describe('Icon', () => {
  it('is hidden next to words and named when it stands alone', () => {
    const { container } = render(<Icon icon={Calendar} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    render(<Icon icon={Calendar} label="期限" />);
    expect(screen.getByRole('img', { name: '期限' })).toBeTruthy();
  });
});

describe('Tag', () => {
  it('gives every status tone an icon', () => {
    const { container } = render(
      <>
        <Tag tone="done">できた</Tag>
        <Tag tone="warning">超過の可能性</Tag>
        <Tag tone="danger">期限超過</Tag>
        <Tag tone="draft">計画中 · 未確定</Tag>
        <Tag icon={Info}>同期中</Tag>
      </>,
    );
    const tags = container.querySelectorAll('[data-slot="tag"]');
    expect(tags).toHaveLength(5);
    for (const tag of tags) expect(tag.querySelector('svg')).not.toBeNull();
  });

  it('shows a label without an icon', () => {
    const { container } = render(<Tag>輪読</Tag>);
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('Divider', () => {
  it('is a separator; the labelled one is a heading when given a level', () => {
    render(
      <>
        <Divider />
        <DividerLabel level={3}>今週</DividerLabel>
      </>,
    );
    expect(screen.getByRole('separator')).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 3, name: '今週' }),
    ).toBeTruthy();
  });
});

describe('Spinner', () => {
  it('announces its words as a status', () => {
    render(<Spinner label="見積中" />);
    expect(screen.getByRole('status').textContent).toBe('見積中');
  });
});

describe('Progress', () => {
  it('shows and speaks the same numbers', () => {
    render(<Progress label="完了" value={7} max={18} unit="件" />);
    const bar = screen.getByRole('progressbar', { name: '完了' });
    expect(bar.getAttribute('aria-valuenow')).toBe('7');
    expect(bar.getAttribute('aria-valuemax')).toBe('18');
    expect(bar.getAttribute('aria-valuetext')).toBe('7 / 18件');
    expect(bar.textContent).toContain('7 / 18件');
  });

  it('uses words while indeterminate', () => {
    render(<Progress label="完了" value={null} max={18} />);
    const bar = screen.getByRole('progressbar', { name: '完了' });
    expect(bar.getAttribute('aria-valuenow')).toBeNull();
    expect(bar.getAttribute('aria-valuetext')).toBe('読み込み中…');
  });
});

describe('Notice', () => {
  it('uses role="alert" for danger only', () => {
    render(
      <>
        <Notice tone="danger" title="読み込めませんでした" />
        <Notice tone="warning" title="超過の可能性" />
        <Notice tone="info" title="Backlog が変わりました" />
        <Notice tone="done" title="反映しました" />
        <Notice tone="neutral" title="補足" />
      </>,
    );
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.textContent).toContain('読み込めませんでした');
  });
});

describe('Kbd', () => {
  it('renders keys as kbd elements', () => {
    const { container } = render(
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>Enter</Kbd>
      </KbdGroup>,
    );
    expect(container.querySelectorAll('kbd')).toHaveLength(3);
  });
});
