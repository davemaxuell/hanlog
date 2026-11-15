/**
 * One-time reference generation. gpt-4o-mini-tts shuts down on 2027-01-06.
 * Default is a dry run; paid calls require --live and --max-calls. Prefer --only <id>.
 * Current language hint: languages[]=ko (gpt-transcribe), not language=ko.
 * https://developers.openai.com/api/docs/guides/speech-to-text
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { MissionSchema } from '../src/lib/contracts';
import { jamoSimilarity } from '../src/lib/scoring/jamo';

type Options = {
  missionsPath?: string; outputDir?: string; only?: string; force?: boolean;
  live?: boolean; maxCalls?: number; apiKey?: string; fetchImpl?: typeof fetch;
};
type Result = { planned: number; generated: number; failed: string[]; requests: number; stopped: boolean };
export async function generateReferenceAudio(options: Options = {}): Promise<Result> {
  const missionsPath = options.missionsPath ?? 'content/missions.json';
  const outputDir = options.outputDir ?? 'public/audio/missions';
  const missions = z.array(MissionSchema).parse(JSON.parse(await readFile(missionsPath, 'utf8')));
  if (options.only && !missions.some(mission => mission.id === options.only)) throw new Error('Unknown mission id');
  const selected = missions.filter(mission => (!options.only || mission.id === options.only) &&
    (options.force || !mission.referenceAudio || !existsSync(join(outputDir, `${mission.id}.mp3`))));
  const result: Result = { planned: selected.length, generated: 0, failed: [], requests: 0, stopped: false };
  if (!options.live || !selected.length) return result;
  if (!options.apiKey) throw new Error('OPENAI_API_KEY is required for --live');
  const maxCalls = options.maxCalls ?? 0;
  if (!Number.isSafeInteger(maxCalls) || maxCalls < selected.length * 2) throw new Error('An explicit --max-calls budget must cover at least two requests per selected mission. Narrow the selection with --only.');
  const fetchImpl: typeof fetch = async (url, init) => {
    if (result.requests >= maxCalls) throw new Error('Request budget exhausted');
    result.requests++;
    return (options.fetchImpl ?? fetch)(url, init);
  };
  const headers = { Authorization: `Bearer ${options.apiKey}` };
  await mkdir(outputDir, { recursive: true });

  for (const mission of selected) {
    let verified: Uint8Array | null = null;
    let similarity = 0;
    try {
      for (const voice of ['marin', 'cedar']) {
        // Do not synthesize another clip unless its verification also fits.
        if (maxCalls - result.requests < 2) throw new Error('Request budget exhausted');
        const speech = await fetchImpl('https://api.openai.com/v1/audio/speech', {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000),
          body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice, input: mission.korean,
            instructions: 'Speak clear, natural Seoul Korean at a calm everyday pace, like a friendly university student.', response_format: 'mp3' }),
        });
        if (!speech.ok) { await speech.body?.cancel(); throw new Error('Speech request failed'); }
        const bytes = new Uint8Array(await speech.arrayBuffer());
        if (bytes.length <= 5_000) throw new Error('Generated clip is too small');
        const form = new FormData();
        form.set('file', new Blob([bytes], { type: 'audio/mpeg' }), `${mission.id}.mp3`);
        form.set('model', 'gpt-transcribe');
        form.append('languages[]', 'ko');
        // No target prompt: verification must not invite the transcriber to echo it.
        const response = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST', headers, body: form, signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) { await response.body?.cancel(); throw new Error('Transcription request failed'); }
        const transcript = z.object({ text: z.string() }).parse(await response.json()).text;
        similarity = jamoSimilarity(transcript, mission.korean);
        if (similarity >= 0.9) { verified = bytes; break; }
      }
      if (!verified) throw new Error('Transcript mismatch');
      const destination = join(outputDir, `${mission.id}.mp3`);
      await writeFile(`${destination}.tmp`, verified);
      await rename(`${destination}.tmp`, destination);
      mission.referenceAudio = `/audio/missions/${mission.id}.mp3`;
      await writeFile(`${missionsPath}.tmp`, JSON.stringify(missions, null, 2) + '\n');
      await rename(`${missionsPath}.tmp`, missionsPath);
      result.generated++;
      console.info(`${mission.id}: ${verified.length} bytes, similarity ${similarity.toFixed(3)}, PASS`);
    } catch {
      // Never print provider response bodies, credentials, or request headers.
      // Keep an existing verified clip if a --force regeneration fails.
      result.failed.push(mission.id);
      result.stopped = true;
      console.info(`${mission.id}: FAIL (generation or verification did not complete)`);
      break; // A failing service or verification must not spend through the catalog.
    }
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.info('npm run content:audio -- [--only <id>] [--force] [--live --max-calls <count>]\nWithout --live: preview only, no API calls. Live mode needs at least two calls per selected mission; a second voice needs two more. No environment file is loaded automatically.');
    return;
  }
  let only: string | undefined;
  let maxCalls: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--only') { only = args[++i]; if (!only || only.startsWith('--')) throw new Error('--only needs a mission id'); }
    else if (args[i] === '--max-calls') { const value = args[++i]; maxCalls = Number(value); if (!value || !Number.isSafeInteger(maxCalls) || maxCalls < 0) throw new Error('--max-calls needs a non-negative integer'); }
    else if (!['--live', '--force'].includes(args[i])) throw new Error(`Unknown option: ${args[i]}`);
  }
  const live = args.includes('--live');
  const result = await generateReferenceAudio({ only, live, maxCalls, force: args.includes('--force'), apiKey: process.env.OPENAI_API_KEY });
  console.info(live ? `${result.generated}/${result.planned} clips generated; ${result.failed.length} failed; ${result.requests} requests made${result.stopped ? '; batch stopped early' : ''}.` : `${result.planned} clips planned (${result.planned * 2} to ${result.planned * 4} requests). Dry run: no API calls. Live mode requires --live --max-calls <count>, preferably with --only <id>.`);
  if (result.failed.length) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Reference generation failed. Check options, the local API key, and the content file.'); process.exitCode = 1; });
}
