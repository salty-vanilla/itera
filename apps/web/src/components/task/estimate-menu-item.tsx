import { Hourglass } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { MenuItem } from '@/components/ui/menu';

// The row's `…` entry to the same place as E: the Task's detail, at its
// Estimate (docs/design/patterns.md リストのキー操作). Only on a row whose
// Task can open a detail (#96). The key sits at the right end (DESIGN.md Kbd),
// and not where the primary pointer is a finger (#163).

type EstimateMenuItemProps = {
  onSelect: () => void;
};

function EstimateMenuItem({ onSelect }: EstimateMenuItemProps) {
  return (
    <MenuItem onClick={onSelect} aria-keyshortcuts="E">
      <Hourglass aria-hidden />
      見積もりを入れる
      <Kbd aria-hidden className="ms-auto text-ink-muted pointer-coarse:hidden">
        E
      </Kbd>
    </MenuItem>
  );
}

export { EstimateMenuItem };
