import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { getMission } from '@/lib/content';
import { createOpenAiProvider } from '@/lib/scoring/openai';
import { composeScore } from '@/lib/scoring/compose';

// Deliberate paid opt-in only. Never enabled by ordinary check, CI, or .env.local.
it.skipIf(process.env.RUN_LIVE !== '1' || !process.env.OPENAI_API_KEY)('scores one native cafe fixture through the real provider', async () => {
  const mission = getMission('cafe-iced-americano')!;
  const provider = createOpenAiProvider({ apiKey: process.env.OPENAI_API_KEY!, model: process.env.OPENAI_SCORING_MODEL ?? 'gpt-audio-1.5', maxRetries: 0 });
  const raw = await provider.score({ mission, wav: new Uint8Array(readFileSync('tests/fixtures/scoring/native-cafe.wav')) });
  expect(composeScore(raw, mission, 'ai').overall).toBeGreaterThanOrEqual(80);
}, 25_000);
