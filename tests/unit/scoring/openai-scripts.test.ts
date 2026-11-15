import { expect, it, vi } from 'vitest';
import { getMission } from '@/lib/content';
import { encodeWavPcm16, validateScoringWav } from '@/lib/audio/wav';
import { FIXTURES, generateFixture, noiseFixture } from '../../../scripts/gen-fixtures';
import { estimateScoringUsd, runSingleSpike } from '../../../scripts/spike-scoring';
import { toneWav } from '../../helpers/audio';

it('normalizes a TTS response into a scoring WAV without retries', async () => {
  const source = encodeWavPcm16(new Float32Array(24_000).fill(0.2), 24_000);
  const f = vi.fn(async () => new Response(new Uint8Array(source)));
  const wav = await generateFixture(FIXTURES[0], 'test-only', f as typeof fetch);
  expect(validateScoringWav(wav)).toMatchObject({ sampleRate: 16_000, durationMs: 1000, channels: 1 });
  expect(f).toHaveBeenCalledTimes(1);
  const fail = vi.fn(async () => new Response('{}', { status: 429 }));
  await expect(generateFixture(FIXTURES[0], 'test-only', fail as typeof fetch)).rejects.toThrow('HTTP 429');
  expect(fail).toHaveBeenCalledTimes(1);
});
it('generates deterministic valid white noise without a service', () => {
  expect(noiseFixture()).toEqual(noiseFixture());
  expect(validateScoringWav(noiseFixture()).durationMs).toBe(3000);
});
it('limits the live spike to one request even for retryable failure', async () => {
  const f = vi.fn(async () => new Response('{}', { status: 503 }));
  const result = await runSingleSpike({ wav: toneWav(600), mission: getMission('cafe-iced-americano')!, apiKey: 'test-only', model: 'gpt-audio-1.5', fetchImpl: f as typeof fetch });
  expect(result).toMatchObject({ requests: 1, status: 503, outcome: 'failed', score: null });
  expect(f).toHaveBeenCalledTimes(1);
});
it('only estimates cost when reported audio usage is available', () => {
  expect(estimateScoringUsd({ prompt_tokens: 1000, completion_tokens: 100 })).toBeNull();
  expect(estimateScoringUsd({ prompt_tokens: 1000, completion_tokens: 100, prompt_tokens_details: { audio_tokens: 100 } })).toBeCloseTo(0.00645);
});
