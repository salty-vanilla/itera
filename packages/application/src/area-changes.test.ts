import { id } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot, fixtureIds } from './fixtures/states';
import { addArea, archive, rename, restore } from './area-changes';
import { backlogData } from './backlog-view';
import { sprintPlanOf } from './planning-view';
import { memoryStore, tagged } from './testing';
import { retroData } from './retro-view';
import { runningData } from './running-view';
import { addAndChoose } from './today-changes';
import { todayData } from './today-view';

const ids = fixtureIds();

const research = id<'Area'>(ids.area.research);

describe('Area changes (Issue #113)', () => {
  it('makes an Area last in the order, with the next color', () => {
    const store = memoryStore(fixtureSnapshot('backlog-capture'));
    const before = store.getSnapshot().records.areas;
    expect(store.run(addArea('  就活 ')).ok).toBe(true);
    const made = store.getSnapshot().records.areas.at(-1);
    expect(made).toMatchObject({
      name: '就活',
      color: before.length + 1,
      order: Math.max(...before.map((a) => a.order)) + 1,
      archived: false,
    });
    expect(store.getSnapshot().records.activities.at(-1)).toMatchObject({
      kind: 'areaCreated',
      name: '就活',
    });
  });

  it('colors the 8th Area made, and the ones after, from area-1 again', () => {
    const store = memoryStore(fixtureSnapshot('backlog-capture'));
    const made = () => store.getSnapshot().records.areas.at(-1)?.color;
    // The fixture has 4 Areas; the 5th to the 7th take area-5 to area-7.
    for (const name of ['就活', 'TA', '趣味']) store.run(addArea(name));
    expect(made()).toBe(7);
    store.run(addArea('家族'));
    expect(made()).toBe(1);
    store.run(addArea('健康'));
    expect(made()).toBe(2);
  });

  it('counts archived Areas in the order of making', () => {
    const store = memoryStore(fixtureSnapshot('backlog-capture'));
    store.run(archive(research));
    store.run(addArea('就活'));
    expect(store.getSnapshot().records.areas.at(-1)?.color).toBe(5);
  });

  it('does not make an Area without a name', () => {
    const store = memoryStore(fixtureSnapshot('backlog-capture'));
    const before = store.getSnapshot().records;
    expect(store.run(addArea('  ')).ok).toBe(false);
    expect(store.getSnapshot().records).toBe(before);
  });

  it('takes an archived Area out of the choices, and keeps it on its Tasks', () => {
    const store = memoryStore(fixtureSnapshot('backlog-capture'));
    store.run(archive(research));
    const { records, clock } = store.getSnapshot();
    const data = backlogData(tagged(records), clock, {});
    expect(data.areas.map((a) => a.id)).not.toContain(research);
    const inIt = data.shown
      .map((taskId) => data.items[taskId])
      .find((i) => i?.task.areaId === research);
    expect(inIt?.area?.name).toBe('研究');
    store.run(restore(research));
    const back = store.getSnapshot();
    expect(
      backlogData(tagged(back.records), back.clock, {}).areas.map((a) => a.id),
    ).toContain(research);
  });

  describe('a rename (F5)', () => {
    it('shows at once on the Backlog, and not on the running Sprint', () => {
      const store = memoryStore(fixtureSnapshot('today-daytime'));
      expect(store.run(rename(research, '研究室')).ok).toBe(true);
      const { records, clock } = store.getSnapshot();
      expect(store.getSnapshot().records.activities.at(-1)).toMatchObject({
        kind: 'areaRenamed',
        from: '研究',
        to: '研究室',
      });

      const backlog = backlogData(tagged(records), clock, {});
      expect(backlog.areas.find((a) => a.id === research)?.name).toBe('研究室');
      expect(
        backlog.shown
          .map((taskId) => backlog.items[taskId])
          .find((i) => i?.task.areaId === research)?.area?.name,
      ).toBe('研究室');

      // The running Sprint keeps the name it took (SprintAreaSnapshot).
      const today = todayData(tagged(records), clock);
      expect(today?.areas.find((a) => a.id === research)?.name).toBe('研究');
      const running = runningData(tagged(records), clock);
      expect(
        running?.plan.find((p) => p.area?.id === research)?.area?.name,
      ).toBe('研究');
    });

    it('does not show on the running Sprint for an Area new to it (F9)', () => {
      // Made in the middle of the week, then used from Today.
      const store = memoryStore(fixtureSnapshot('today-daytime'));
      store.run(addArea('就活'));
      const made = store.getSnapshot().records.areas.at(-1)!;
      const active = () =>
        store.getSnapshot().records.sprints.find((s) => s.state === 'active');
      const { today } = store.getSnapshot().clock;
      expect(
        store.run(addAndChoose(active()!.id, today, 'ES を書く', made.id)).ok,
      ).toBe(true);
      expect(active()?.areaSnapshot.at(-1)).toMatchObject({
        areaId: made.id,
        name: '就活',
      });
      store.run(rename(made.id, '就職活動'));
      const { records, clock } = store.getSnapshot();
      expect(todayData(tagged(records), clock)?.areas.at(-1)?.name).toBe(
        '就活',
      );
      expect(
        backlogData(tagged(records), clock, {}).areas.find(
          (a) => a.id === made.id,
        )?.name,
      ).toBe('就職活動');
    });

    it('shows on the next Sprint being planned, and not on a past one', () => {
      const store = memoryStore(fixtureSnapshot('planning-pick'));
      const past = store
        .getSnapshot()
        .records.sprints.find((s) => s.state === 'closed');
      if (past === undefined) throw new Error('no closed Sprint');
      store.run(rename(research, '研究室'));
      const { clock } = store.getSnapshot();
      const records = tagged(store.getSnapshot().records);

      const sprint = records.sprints.find((s) => s.state === 'planning');
      if (sprint === undefined) throw new Error('no Sprint being planned');
      const planning = sprintPlanOf(records, clock, sprint, {
        applyCriterion: true,
      });
      expect(planning.areas.find((a) => a.id === research)?.name).toBe(
        '研究室',
      );
      expect(
        retroData(tagged(records), clock, past.id)?.sprintAreas[research]?.name,
      ).toBe('研究');
    });
  });
});
