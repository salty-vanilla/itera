import type { RetroData } from '@/screen-data/retro-view';
import type { RetroStage } from './retro-screen';

/**
 * The stage a Retro opens on when the URL names none (the navigation, #111):
 * where the writing has got to, from the records. A stored improvement is
 * 確定 as far as the screen goes (it is saved as it is typed and opens as
 * set); a decision on the Sprint's criterion is made in 引き継ぐ. A closed
 * Retro has no writing left to continue, so it opens on the facts. Nothing
 * of this is stored; `?stage=` opens any stage.
 */
export function retroStageOf(
  data: Pick<RetroData, 'improvement' | 'reflection' | 'used' | 'sprint'>,
): RetroStage {
  if (data.sprint.state === 'closed') return 'facts';
  if (data.improvement !== undefined || data.used?.decision !== undefined) {
    return 'handoff';
  }
  if (data.reflection.trim() !== '') return 'reflect';
  return 'facts';
}
