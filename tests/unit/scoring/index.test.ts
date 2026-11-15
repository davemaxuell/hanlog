import { expect, it } from 'vitest';
import { getMission } from '@/lib/content';
import { getScoringProvider, scoreAttempt } from '@/lib/scoring';
import { NoSpeechError } from '@/lib/scoring/types';
import { noiseWav, silentWav, toneWav } from '../../helpers/audio';

const mission = getMission('cafe-iced-americano')!;
it('uses the mock provider with no configuration', () => { expect(getScoringProvider().name).toBe('mock'); });
it('scores audible audio deterministically', async () => {
  const a = await scoreAttempt(toneWav(1500), mission);
  expect(a).toMatchObject({ overall: 88, heard: mission.korean, scoredBy: 'mock' });
  expect(a.issues).toHaveLength(1);
  expect(await scoreAttempt(noiseWav(1500), mission)).toEqual(a);
});
it('reports silence as no speech', async () => {
  await expect(scoreAttempt(silentWav(1500), mission)).rejects.toBeInstanceOf(NoSpeechError);
});
