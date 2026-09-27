import { describe, expect, it } from 'vitest';
import { archiveArea, createArea, renameArea, restoreArea } from './area';
import { id } from './shared/ids';
import { ctx, unwrap, userId } from './testing';

function research() {
  return unwrap(
    createArea(
      { id: id('area-research'), userId, name: '研究', color: 2, order: 1 },
      ctx,
    ),
  );
}

describe('Area', () => {
  it('keeps renames as Activity entries', () => {
    const result = renameArea(research(), ' 研究・論文 ', ctx);
    expect(unwrap(result).name).toBe('研究・論文');
    expect(result.ok && result.value.activities).toEqual([
      {
        kind: 'areaRenamed',
        at: ctx.now,
        actor: 'user',
        areaId: 'area-research',
        from: '研究',
        to: '研究・論文',
      },
    ]);
  });

  it('a rename to the same name appends nothing', () => {
    const result = renameArea(research(), '研究', ctx);
    expect(result.ok && result.value.activities).toEqual([]);
  });

  it('rejects an empty name', () => {
    expect(renameArea(research(), ' ', ctx)).toMatchObject({ ok: false });
    expect(
      createArea({ id: id('a'), userId, name: '', color: 1, order: 0 }, ctx),
    ).toMatchObject({ ok: false });
  });

  it('archives and restores', () => {
    const archived = unwrap(archiveArea(research(), ctx));
    expect(archived.archived).toBe(true);
    expect(archiveArea(archived, ctx)).toMatchObject({ ok: false });
    expect(unwrap(restoreArea(archived, ctx)).archived).toBe(false);
  });
});
