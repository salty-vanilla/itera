import { useLocation } from '@tanstack/react-router';

/** The screens and the Issues that move them to the contract. */
const MOVES: Readonly<Record<string, string>> = {
  '/sprint': '#274',
  '/retro': '#276',
};

/**
 * In place of a screen still on the store (NotOnContractError), with the
 * API as the data source. For the developer, in English: not the product's
 * words. #277 removes it.
 */
function NotOnContract() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const issue = MOVES[pathname] ?? '#274〜#276';
  return (
    <p lang="en" className="p-6 text-body text-ink-muted">
      {`Not on the API yet: ${pathname} moves to the contract in ${issue}. Open it with the browser mock (pnpm --filter @itera/web dev).`}
    </p>
  );
}

export { NotOnContract };
