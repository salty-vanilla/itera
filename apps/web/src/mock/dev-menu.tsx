import { useNavigate } from '@tanstack/react-router';
import type { PlainProblemType } from '@itera/api-contract/problems';
import { useState, useSyncExternalStore } from 'react';
import { FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu';
import {
  fixtureStates,
  isFixtureStateId,
  type FixtureStateId,
} from './fixture-states';
import { formatDate, formatTime } from '@/lib/date-format';
import { screens } from '@/app/screens';
import type { RecordStore } from './memory-store';
import type { Mock } from './mock-api';

// Development only, with the browser mock (mock-data.tsx).
// Switches the fixture state (PRD §12) and opens its screen. The same state
// opens from the URL: `?fixture=<id>`. It can also make every write fail,
// to look at the screens of a failed save (#332).

/** The failures a write can be made to end in, by what the screen says. */
const writeFailures = [
  { value: 'none', label: '失敗させない' },
  { value: '/problems/precondition-failed', label: 'ほかの端末で変わっていた' },
  { value: '/problems/invalid-input', label: '保存できない' },
  { value: '/problems/internal-error', label: '保存できたかわからない' },
] as const satisfies readonly {
  value: PlainProblemType | 'none';
  label: string;
}[];

function DevMenu({
  current,
  store,
  mock,
}: {
  current: FixtureStateId;
  store: RecordStore;
  mock: Mock;
}) {
  const navigate = useNavigate();
  const [failing, setFailing] = useState<PlainProblemType | 'none'>('none');
  const { records, clock } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
  );
  const { today, now } = clock;
  const { timeZone } = records.user;
  const state = fixtureStates.find((s) => s.id === current);
  const screenLabel = screens.find((s) => s.id === state?.screen)?.label;
  const clockText = `${formatDate(today)} ${formatTime(now, timeZone)}`;

  return (
    // Out of the headings and of the compact Quick Add: top right and
    // icon-only under 768px, bottom right with its words from 768px.
    <div className="fixed top-2 right-2 z-(--layer-sticky) medium:top-auto medium:bottom-2">
      <Menu>
        <MenuTrigger render={<Button size="sm" />}>
          <FlaskConical aria-hidden />
          <span className="sr-only medium:not-sr-only">
            {screenLabel} {state?.label}
          </span>
          <span className="sr-only text-ink-muted medium:not-sr-only">
            {clockText}
          </span>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuRadioGroup
            value={current}
            onValueChange={(value: unknown) => {
              if (!isFixtureStateId(value)) return;
              const next = fixtureStates.find((s) => s.id === value);
              const path = screens.find((s) => s.id === next?.screen)?.path;
              // The state's own screen parameters (an open Task, a 切り口).
              const query = new URLSearchParams({
                fixture: value,
                ...next?.search,
              });
              void navigate({ href: `${path ?? '/today'}?${query}` });
            }}
          >
            {screens.map((screen, index) => (
              <MenuGroup key={screen.id}>
                {index > 0 && <MenuSeparator />}
                <MenuGroupLabel>{screen.label}</MenuGroupLabel>
                {fixtureStates
                  .filter((s) => s.screen === screen.id)
                  .map((s) => (
                    <MenuRadioItem key={s.id} value={s.id}>
                      {s.label}
                    </MenuRadioItem>
                  ))}
              </MenuGroup>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuRadioGroup
            value={failing}
            onValueChange={(value: unknown) => {
              const next = writeFailures.find((f) => f.value === value);
              if (next === undefined) return;
              setFailing(next.value);
              mock.failWrites(next.value === 'none' ? undefined : next.value);
            }}
          >
            <MenuGroup>
              <MenuGroupLabel>書き込み</MenuGroupLabel>
              {writeFailures.map((f) => (
                <MenuRadioItem key={f.value} value={f.value}>
                  {f.label}
                </MenuRadioItem>
              ))}
            </MenuGroup>
          </MenuRadioGroup>
        </MenuContent>
      </Menu>
    </div>
  );
}

export { DevMenu };
