import { useNavigate, useRouter } from '@tanstack/react-router';
import type { SprintHeaderProps } from '@/components/sprint/sprint-header';
import { isPlainClick } from '@/lib/plain-click';

/** What the header's ‹ › need of a Sprint: its number, in the URL. */
interface StepTarget {
  readonly number: number;
}

/**
 * The Sprint Header's ‹ ›: the previous and next Sprint on the same screen,
 * by number in the URL (#90). The screen's other search parameters (the
 * stage, the open Task) are for that Sprint and are left behind.
 */
export function useSprintSteps(
  to: '/sprint' | '/retro',
  choice: { readonly previous?: StepTarget; readonly next?: StepTarget },
): NonNullable<SprintHeaderProps['steps']> {
  const router = useRouter();
  const navigate = useNavigate();
  const step = (ref: StepTarget | undefined) =>
    ref && {
      number: ref.number,
      href: router.buildLocation({ to, search: { sprint: ref.number } }).href,
    };
  return {
    previous: step(choice.previous),
    next: step(choice.next),
    onStep: (target, event) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      void navigate({ to, search: { sprint: target.number } });
    },
  };
}

/**
 * `?sprint=3`: a Sprint's number (F25), a whole number from 1. Anything
 * else is dropped and the screen opens the current Sprint (ADR 0005). A
 * number with no Sprint also opens the current one; the screen decides.
 * A dropped value is set to `undefined`, not left out: the router lays a
 * route's search over the URL's own values, which would bring it back.
 */
export function sprintSearchOf(search: Record<string, unknown>): {
  sprint: number | undefined;
} {
  const value =
    typeof search.sprint === 'string' && /^\d+$/.test(search.sprint)
      ? Number(search.sprint)
      : search.sprint;
  return {
    sprint:
      typeof value === 'number' && Number.isInteger(value) && value >= 1
        ? value
        : undefined,
  };
}
