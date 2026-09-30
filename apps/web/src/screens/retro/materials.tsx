import type { RetroPin } from '@itera/domain';
import { formatDate, formatTime } from '@/lib/date-format';
import { formatHours } from '@/lib/time-format';
import { cn } from '@/lib/utils';
import type { RetroData } from '@/store/retro-view';
import { OUTCOME_WORDS, occurrenceWord, PinToggle } from './retro-words';

// 振り返りの材料 (DESIGN.md RetroInsight, fact): the facts marked 振り返りに使う,
// gathered at the side. Facts in `body`; the person's own words are
// elsewhere, in `reflection`. Marking is optional.

function pinText(pin: RetroPin, data: RetroData): string | undefined {
  const { facts } = data;
  switch (pin.kind) {
    case 'sprintTask': {
      const t = facts.tasks.find((x) => x.sprintTaskId === pin.id);
      return t && `${t.title} · ${OUTCOME_WORDS[t.outcome]}`;
    }
    case 'goal': {
      const area = facts.areas.find((a) => a.areaId === pin.id);
      return area?.goal && `${area.name ?? ''}の目標「${area.goal.text}」`;
    }
    case 'dailySelection': {
      const s = data.sprint.dailySelections.find((x) => x.id === pin.id);
      if (s === undefined) return undefined;
      const word =
        s.resolution === 'paused' || s.closedBefore?.resolution === 'paused'
          ? '今日はここまで'
          : '見送り';
      return `${formatDate(s.date)} ${word} · ${data.titleOf(s.sprintTaskId)}`;
    }
    case 'occurrence': {
      const found = data.occurrences.find((x) => x.occurrence.id === pin.id);
      return (
        found &&
        `${formatDate(found.occurrence.scheduledDate)} ${found.title} · ${occurrenceWord(found.occurrence.state)}`
      );
    }
    case 'interrupt': {
      const n = facts.interrupts.find((x) => x.id === pin.id);
      return (
        n &&
        `割り込み ${formatTime(n.at, data.timeZone)} ${n.text}${
          n.minutes === undefined ? '' : ` · ${formatHours(n.minutes / 60)}`
        }`
      );
    }
    case 'availableHours': {
      const { planned, current } = facts.availableHours;
      return `使える時間 計画時 ${planned === undefined ? '未入力' : formatHours(planned, { total: true })} → 今 ${current === undefined ? '未入力' : formatHours(current, { total: true })}`;
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
  onPin: (pin: RetroPin) => void;
  headingLevel?: 2 | 3;
  className?: string | undefined;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const items = data.pins.flatMap((pin) => {
    const text = pinText(pin, data);
    return text === undefined ? [] : [{ pin, text }];
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
          事実に「振り返りに使う」の印を付けると、ここに集まります。付けなくても先へ進めます。
        </p>
      ) : (
        <ul className="flex flex-col border-t border-border-soft">
          {items.map(({ pin, text }) => (
            <li
              key={`${pin.kind}-${pin.id ?? ''}`}
              className="flex items-center justify-between gap-2 border-b border-border-soft py-1 text-body text-ink"
            >
              <span className="min-w-0">{text}</span>
              <PinToggle pinned subject={text} onToggle={() => onPin(pin)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { Materials };
