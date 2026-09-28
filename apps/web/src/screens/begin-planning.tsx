import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useNextPlanning, useRetroActions } from '@/store/use-retro';

/**
 * 「Sprint N の計画を始める」 (owner decision in #42): starts the next
 * week's Planning — allowed even while the previous Retro is open, as only
 * confirming waits for it (invariant 12) — and opens the Sprint screen.
 * With a Planning already started, it links there instead.
 */
function BeginPlanning() {
  const next = useNextPlanning();
  const actions = useRetroActions();
  const navigate = useNavigate();
  if (next.planning !== undefined) {
    return (
      <Link
        to="/sprint"
        data-slot="begin-planning"
        className="text-link underline focus-visible:focus-ring"
      >
        Sprint {next.number} の計画を開く
      </Link>
    );
  }
  return (
    <Button
      data-slot="begin-planning"
      variant="primary"
      onClick={() => {
        if (actions.beginPlanning()) void navigate({ to: '/sprint' });
      }}
    >
      Sprint {next.number} の計画を始める
    </Button>
  );
}

export { BeginPlanning };
