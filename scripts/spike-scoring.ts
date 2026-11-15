import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getMission } from '../src/lib/content';
import type { Mission } from '../src/lib/contracts';
import { validateScoringWav } from '../src/lib/audio/wav';
import { composeScore } from '../src/lib/scoring/compose';
import { createOpenAiProvider, scoringUsage } from '../src/lib/scoring/openai';

export function estimateScoringUsd(usage: ReturnType<typeof scoringUsage>): number | null {
  const prompt = usage.prompt_tokens;
  const completion = usage.completion_tokens;
  const details = usage.prompt_tokens_details;
  const outputDetails = usage.completion_tokens_details;
  if (typeof prompt !== 'number' || typeof completion !== 'number' || !details || typeof details !== 'object' || typeof details.audio_tokens !== 'number') return null;
  const audioOut = typeof outputDetails === 'object' ? outputDetails.audio_tokens ?? 0 : 0;
  return ((prompt - details.audio_tokens) * 2.5 + details.audio_tokens * 32 + (completion - audioOut) * 10 + audioOut * 64) / 1_000_000;
}

export async function runSingleSpike(input: { wav: Uint8Array; mission: Mission; apiKey: string; model: string; fetchImpl?: typeof fetch }) {
  const durationMs = validateScoringWav(input.wav).durationMs;
  let requests = 0;
  let status: number | null = null;
  let usage: ReturnType<typeof scoringUsage> = {};
  const fetchImpl: typeof fetch = async (url, init) => {
    if (++requests > 1) throw new Error('Single-request limit exceeded.');
    const response = await (input.fetchImpl ?? globalThis.fetch)(url, init);
    status = response.status;
    if (response.ok) usage = scoringUsage(await response.clone().json());
    return response;
  };
  const started = performance.now();
  const provider = createOpenAiProvider({ apiKey: input.apiKey, model: input.model, fetchImpl, maxRetries: 0 });
  try {
    const raw = await provider.score({ wav: input.wav, mission: input.mission });
    const score = composeScore(raw, input.mission, 'ai');
    return { date: new Date().toISOString(), variant: 'V2', requests, status, durationMs, ms: Math.round(performance.now() - started), score, usage, estimatedUsd: estimateScoringUsd(usage), outcome: 'scored' };
  } catch {
    return { date: new Date().toISOString(), variant: 'V2', requests, status, durationMs, ms: Math.round(performance.now() - started), score: null, usage, estimatedUsd: estimateScoringUsd(usage), outcome: 'failed' };
  }
}

async function main() {
  if (!process.argv.includes('--live')) {
    console.info('Dry run: zero requests. --live scores native-cafe.wav once, with no retries or variant search.');
    return;
  }
  const output = resolve('docs/spike/latest-single.json');
  if (existsSync(output) && !process.argv.includes('--force')) throw new Error('A single-check result already exists. No request made. Use --force only when another paid check is intended.');
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is required for --live.');
  const mission = getMission('cafe-iced-americano')!;
  const wav = new Uint8Array(readFileSync('tests/fixtures/scoring/native-cafe.wav'));
  const result = await runSingleSpike({ wav, mission, apiKey: key, model: process.env.OPENAI_SCORING_MODEL ?? 'gpt-audio-1.5' });
  mkdirSync(resolve('docs/spike'), { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.info(JSON.stringify(result, null, 2));
  if (result.outcome !== 'scored') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : 'Single scoring check failed.'); process.exitCode = 1; });
}
