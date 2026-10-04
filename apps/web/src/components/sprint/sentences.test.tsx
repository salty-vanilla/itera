// jsdom has no layout, so this pins the structure #357 relies on: a sentence
// with a note in 「（）」 is one box that can shrink to the line, breaking only
// before the note; a plain sentence is one unbreakable piece, as before. The
// 320px measure is in the PR.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Sentences } from './capacity-indicator';

afterEach(cleanup);

const pieces = (container: HTMLElement) =>
  [...container.querySelectorAll('.nowrap-phrase')].map((e) => e.textContent);

describe('Sentences (#239, #357)', () => {
  it('keeps a plain sentence whole, with the 「·」 at its end', () => {
    const { container } = render(
      <p>
        <Sentences
          items={['少なく済めば 45分残る', '多くかかれば 15分超える']}
        />
      </p>,
    );
    expect(pieces(container)).toEqual([
      '少なく済めば 45分残る ·',
      '多くかかれば 15分超える',
    ]);
    expect(container.querySelector('.inline-block')).toBeNull();
  });

  it('lets a sentence with a note break only before the note', () => {
    const { container } = render(
      <p>
        <Sentences
          items={[
            '計画 2時間30分（サブタスク 1件は見積もりなし）',
            '実績 1時間',
          ]}
        />
      </p>,
    );
    expect(pieces(container)).toEqual([
      '計画 2時間30分',
      '（サブタスク 1件は見積もりなし） ·',
      '実績 1時間',
    ]);
    const box = container.querySelector('.inline-block');
    expect(box?.className).toContain('max-w-full');
    expect(box?.textContent).toBe(
      '計画 2時間30分（サブタスク 1件は見積もりなし） ·',
    );
  });

  it('says the text as it was', () => {
    const { container } = render(
      <p>
        <Sentences items={['計画 5時間（ルール）', '実績 4時間30分']} />
      </p>,
    );
    expect(container.textContent).toBe('計画 5時間（ルール） · 実績 4時間30分');
  });
});
