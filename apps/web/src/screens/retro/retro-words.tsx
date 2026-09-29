import type {
  RetroPin,
  SelfAssessment,
  SprintTaskOutcome,
} from '@itera/domain';
import {
  Circle,
  CircleCheck,
  CircleMinus,
  Contrast,
  Check,
  Pin,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';

// Words and small parts shared by the Retro panes. Facts are written
// neutrally, never as failures (patterns.md Retro › ルール).

/**
 * Goal の自己判定 (owner decision in #42): the circle's fill tells them
 * apart with the word, never color. できなかった is not red and has no ×.
 */
export const ASSESSMENTS: readonly {
  value: SelfAssessment;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: 'achieved', label: 'できた', icon: CircleCheck },
  { value: 'partly', label: '一部できた', icon: Contrast },
  { value: 'notAchieved', label: 'できなかった', icon: Circle },
  { value: 'notJudged', label: '判断しない', icon: CircleMinus },
];

export function AssessmentTag({ value }: { value: SelfAssessment }) {
  const found = ASSESSMENTS.find((a) => a.value === value);
  if (found === undefined) return null;
  return value === 'achieved' ? (
    <Tag tone="done">{found.label}</Tag>
  ) : (
    <Tag tone="neutral" icon={found.icon}>
      {found.label}
    </Tag>
  );
}

export const OUTCOME_WORDS: Readonly<Record<SprintTaskOutcome, string>> = {
  draft: '下書き',
  planned: '予定',
  done: '完了',
  carriedOver: '持ち越し',
  removed: '外した',
};

/** The states an occurrence shows in Retro (done / skipped / missed). */
export const OCCURRENCE_WORDS: Readonly<
  Record<'done' | 'skipped' | 'missed', string>
> = {
  done: '完了',
  skipped: 'スキップ',
  missed: '未処理',
};

/** An occurrence's state in words; Retro lists only these three. */
export function occurrenceWord(state: string): string {
  return state in OCCURRENCE_WORDS
    ? OCCURRENCE_WORDS[state as keyof typeof OCCURRENCE_WORDS]
    : '';
}

export const samePin = (a: RetroPin, b: RetroPin) =>
  a.kind === b.kind && a.id === b.id;

/**
 * 気になる: marks a fact so that it gathers in 振り返りの材料. Optional;
 * the Retro moves on without any.
 */
export function PinToggle({
  pinned,
  subject,
  onToggle,
}: {
  pinned: boolean;
  /** What is marked, read out with the button. */
  subject: string;
  onToggle: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="quiet"
      aria-pressed={pinned}
      onClick={onToggle}
      // Pressed: a check replaces the pin and the surface stays pressed, so
      // the state is not in color alone (no filled icons, foundations.md).
      className={pinned ? 'bg-surface-pressed text-ink' : 'text-ink-muted'}
    >
      {pinned ? <Check aria-hidden /> : <Pin aria-hidden />}
      気になる
      <span className="sr-only">: {subject}</span>
    </Button>
  );
}
