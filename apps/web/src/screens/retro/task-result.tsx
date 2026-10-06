import type { TaskFact } from '@itera/api-contract';
import { Fragment } from 'react';
import { Icon, semanticIcons, type IconSize } from '@/components/ui/icon';
import { resultText } from './task-values';

// How a Task ended, in words (task-values `resultText`). A carry-over has its
// fixed icon and `ink-muted` beside the word, so it is not read as done
// (DESIGN.md CarryOverIndicator, foundations.md 意味の固定); never `danger`.
// It breaks only between its parts (「繰り返し：完了 2 · スキップ 1」).

function TaskResult({
  fact,
  iconSize = 's',
}: {
  fact: TaskFact;
  /** `xs` (12px) inside 12px meta text. */
  iconSize?: IconSize;
}) {
  const carried = !fact.recurring && fact.outcome === 'carriedOver';
  return resultText(fact)
    .split(' · ')
    .map((part, i) => (
      <Fragment key={part}>
        {i > 0 && ' · '}
        <span
          className={
            carried
              ? 'inline-flex items-center gap-1 nowrap-phrase text-ink-muted'
              : 'nowrap-phrase'
          }
        >
          {carried && <Icon icon={semanticIcons.carriedOver} size={iconSize} />}
          {part}
        </span>
      </Fragment>
    ));
}

export { TaskResult };
