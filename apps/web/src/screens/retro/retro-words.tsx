import type {
  CarryOverPlaces,
  RetroDecision,
  RetroPin,
  SelfAssessment,
  SprintTaskOutcome,
} from '@itera/api-contract';
import {
  Circle,
  CircleCheck,
  CircleMinus,
  Contrast,
  Check,
  Pin,
  type LucideIcon,
} from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { Tag } from '@/components/ui/tag';

// Words and small parts shared by the Retro panes. Facts are written
// neutrally, never as failures (patterns.md Retro › ルール).

/**
 * Goal の自己判定 (owner decision in #42): the circle's fill tells them
 * apart with the word, never color. できなかった is not red and has no ×.
 * The Tag says what was chosen, so 決めない reads 決めなかった there (#205).
 */
export const ASSESSMENTS: readonly {
  value: SelfAssessment;
  label: string;
  /** The Tag's word, when it differs from the choice's. */
  tag?: string;
  icon: LucideIcon;
}[] = [
  { value: 'achieved', label: 'できた', icon: CircleCheck },
  { value: 'partly', label: '一部できた', icon: Contrast },
  { value: 'notAchieved', label: 'できなかった', icon: Circle },
  {
    value: 'notJudged',
    label: '決めない',
    tag: '決めなかった',
    icon: CircleMinus,
  },
];

export function AssessmentTag({ value }: { value: SelfAssessment }) {
  const found = ASSESSMENTS.find((a) => a.value === value);
  if (found === undefined) return null;
  return value === 'achieved' ? (
    <Tag tone="done">{found.tag ?? found.label}</Tag>
  ) : (
    <Tag tone="neutral" icon={found.icon}>
      {found.tag ?? found.label}
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
  missed: '未完了',
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
 * 振り返りに使う: marks a fact so that it gathers in 振り返りの材料. Optional;
 * the Retro moves on without any. An icon toggle, as it is on every row: the
 * words are said once, in the guide above the facts (#241), and are its name.
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
    <IconButton
      size="sm"
      // On, it looks chosen rather than inverted (DESIGN.md Selected, #242):
      // the yellow of a chosen item, with a check in place of the pin, so
      // that a marked fact stands out among the many unmarked ones, not by
      // color alone (#167), and the screen's one Primary stays the only fill.
      pressed={pinned}
      pressedLook="selection"
      label={`振り返りに使う：${subject}`}
      icon={pinned ? <Check /> : <Pin />}
      onClick={onToggle}
    />
  );
}

/** The three choices for the criterion a Sprint used (invariant 36). */
export const DECISION_WORDS: Readonly<Record<RetroDecision, string>> = {
  continue: '続ける',
  end: '終える',
  replace: '置き換える',
};

/** A carried-over Task that is not a candidate: where it is instead. */
export const CARRY_OVER_PLACE_WORDS = {
  inNext: '次の Sprint に入っています',
  completed: '完了',
  archived: 'アーカイブ',
} as const;

/**
 * Where the carried-over Tasks are, by count, for the Dialog of 「振り返りを
 * 完了」 (#107). The Tasks themselves are listed in 引き継ぐ (#169). Retro
 * moves none of them (invariant 20).
 */
export function carryOverWords(places: CarryOverPlaces): string {
  const parts = [
    places.inNext > 0 && `次の Sprint に ${places.inNext}件`,
    places.candidates > 0 && `Backlog に ${places.candidates}件`,
    places.completed > 0 && `完了 ${places.completed}件`,
    places.archived > 0 && `アーカイブ ${places.archived}件`,
  ].filter((p) => p !== false);
  return parts.length > 1
    ? `${places.total}件：${parts.join(' · ')}`
    : parts.join('');
}
