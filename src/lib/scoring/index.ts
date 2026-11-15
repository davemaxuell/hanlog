import { getConfig } from '../config';
import type { Mission, Score } from '../contracts';
import { composeScore } from './compose';
import { mockProvider } from './mock';
import { createOpenAiProvider } from './openai';
import type { ScoringProvider } from './types';
export function getScoringProvider(): ScoringProvider {
  const config = getConfig();
  return config.scoringProvider === 'mock' ? mockProvider : createOpenAiProvider({ apiKey: config.openaiApiKey!, model: config.scoringModel });
}
export async function scoreAttempt(wav: Uint8Array, mission: Mission): Promise<Score> {
  const provider = getScoringProvider();
  return composeScore(await provider.score({ wav, mission }), mission, provider.name === 'mock' ? 'mock' : 'ai');
}
