import { wavRms } from '../audio/wav';
import { LIMITS } from '../contracts';
import type { ScoringProvider } from './types';
export const mockProvider: ScoringProvider = {
  name: 'mock',
  async score({ wav, mission }) {
    return { speechDetected: wavRms(wav) >= LIMITS.silenceRms, heard: mission.korean, pronunciation: 84, accuracy: 96, usage: 88,
      issues: [{ segment: mission.korean.match(/[\uAC00-\uD7A3]/u)?.[0] ?? '', problem: 'Demo feedback: the final consonant was a little soft.', tip: 'Hold the final consonant briefly before the next syllable.' }],
      praise: 'Clear and confident. Nice work.', nextTip: 'Try it once more at natural speed.' };
  },
};
