import type { RetroPin } from '@itera/domain';
import type { ReactNode } from 'react';
import { semanticIcons } from '@/components/ui/icon';
import { MetaItem, TaskMetadata } from '@/components/task/task-metadata';
import { formatDate, formatDateTime } from '@/lib/date-format';
import { SELECTION_WORDS } from '@/lib/selection-words';
import { formatHours } from '@/lib/time-format';
import { cn } from '@/lib/utils';
import type { RetroData } from '@/store/retro-view';
import { occurrenceWord, PinToggle } from './retro-words';
import {
  actualLabel,
  differenceText,
  plannedLabel,
  resultText,
} from './task-values';

// 振り返りの材料 (DESIGN.md RetroInsight, fact): the facts marked 振り返りに使う,
// gathered at the side. Facts in `body`; the person's own words are
// elsewhere, in `reflection`. Marking is optional. A closed Retro lists
// them without the toggles (#90).

/**
 * A pinned fact: its own words (`lead`), which wrap where they must, and the
 * values that go with it (`meta`, Task Metadata style: 12px, apart by space
 * rather than by 「 · 」, so a line never ends on a separator). A value is one
 * unit and moves to the next line whole, never split by a character or two
 * (#127). `text` is the same in one string, for the button's name.
 */
type Pinned = { text: string; lead: string; meta: ReactNode[] };

const CarryIcon = semanticIcons.carriedOver;

/**
 * Each fact reads as the row it was pinned from: a Task with the values of
 * its row (#108), a day or time in the form of the lists.
 */
function pinned(pin: RetroPin, data: RetroData): Pinned | undefined {
  const { facts } = data;
  const item = (value: string, icon?: ReactNode) => (
    <MetaItem key={value} icon={icon} wrap>
      {value}
    </MetaItem>
  );
  const withMeta = (
    lead: string,
    values: readonly string[],
    meta: ReactNode[],
  ) => ({
    text: [lead, ...values].join(' · '),
    lead,
    meta,
  });
  switch (pin.kind) {
    case 'sprintTask': {
      const t = facts.tasks.find((x) => x.sprintTaskId === pin.id);
      if (t === undefined) return undefined;
      // The same words and the carry-over's icon as in the table.
      const carried = !t.recurring && t.outcome === 'carriedOver';
      const results = resultText(t, data).split(' · ');
      const difference = differenceText(t);
      const values = [
        plannedLabel(t),
        actualLabel(t),
        ...(difference === undefined ? [] : [difference]),
      ];
      return withMeta(
        t.title,
        [...results, ...values],
        [
          ...results.map((r) =>
            item(r, carried ? <CarryIcon aria-hidden /> : undefined),
          ),
          ...values.map((v) => item(v)),
        ],
      );
    }
    case 'goal': {
      const area = facts.areas.find((a) => a.areaId === pin.id);
      if (area?.goal === undefined) return undefined;
      return withMeta(`${area.name ?? ''}の目標「${area.goal.text}」`, [], []);
    }
    case 'dailySelection': {
      const s = data.sprint.dailySelections.find((x) => x.id === pin.id);
      if (s === undefined) return undefined;
      const word =
        s.resolution === 'paused' || s.closedBefore?.resolution === 'paused'
          ? SELECTION_WORDS.paused
          : SELECTION_WORDS.deferred;
      const values = [formatDate(s.date), word];
      return withMeta(
        data.titleOf(s.sprintTaskId),
        values,
        values.map((v) => item(v)),
      );
    }
    case 'occurrence': {
      const found = data.occurrences.find((x) => x.occurrence.id === pin.id);
      if (found === undefined) return undefined;
      const values = [
        formatDate(found.occurrence.scheduledDate),
        occurrenceWord(found.occurrence.state),
      ];
      return withMeta(
        found.title,
        values,
        values.map((v) => item(v)),
      );
    }
    case 'interrupt': {
      const n = facts.interrupts.find((x) => x.id === pin.id);
      if (n === undefined) return undefined;
      const values = [
        formatDateTime(n.at, data.timeZone),
        ...(n.minutes === undefined ? [] : [formatHours(n.minutes / 60)]),
      ];
      return withMeta(
        `割り込み ${n.text}`,
        values,
        values.map((v) => item(v)),
      );
    }
    case 'availableHours': {
      const { planned, current } = facts.availableHours;
      const hours = (h: number | undefined) =>
        h === undefined ? '未入力' : formatHours(h, { total: true });
      const values = [
        `計画したとき ${hours(planned)}`,
        `→ 今 ${hours(current)}`,
      ];
      return withMeta(
        '使える時間',
        values,
        values.map((v) => item(v)),
      );
    }
  }
}

function Materials({
  data,
  onPin,
  headingLevel = 2,
  className,
}: {
  data: RetroData;
  /** Absent in a closed Retro: read only. */
  onPin: ((pin: RetroPin) => void) | undefined;
  headingLevel?: 2 | 3;
  className?: string | undefined;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const items = data.pins.flatMap((pin) => {
    const found = pinned(pin, data);
    return found === undefined ? [] : [{ pin, ...found }];
  });
  return (
    <section
      aria-label="振り返りの材料"
      data-slot="retro-materials"
      className={cn('flex flex-col gap-3', className)}
    >
      <Heading className="text-subheading text-ink">振り返りの材料</Heading>
      {items.length === 0 ? (
        <p className="text-help text-ink-muted">
          {onPin === undefined
            ? '「振り返りに使う」の印を付けた事実はありません。'
            : '事実に「振り返りに使う」の印を付けると、ここに集まります。付けなくても先へ進めます。'}
        </p>
      ) : (
        <ul className="flex flex-col border-t border-border-soft">
          {items.map(({ pin, text, lead, meta }) => (
            <li
              key={`${pin.kind}-${pin.id ?? ''}`}
              // The toggle goes under the words when both do not fit.
              className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-border-soft py-1 text-body text-ink"
            >
              <span className="flex min-w-0 grow basis-[10rem] flex-col gap-1">
                <span className="text-balance [word-break:auto-phrase]">
                  {lead}
                </span>
                {/* The spaces do not show in the flex lines; they keep the words apart in the text. */}
                {meta.length > 0 && (
                  <>
                    {' '}
                    <TaskMetadata>
                      {meta.flatMap((m, i) => (i === 0 ? [m] : [' ', m]))}
                    </TaskMetadata>
                  </>
                )}
              </span>
              {onPin !== undefined && (
                <span className="ms-auto shrink-0">
                  <PinToggle
                    pinned
                    subject={text}
                    onToggle={() => onPin(pin)}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { Materials };
