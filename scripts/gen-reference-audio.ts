/**
 * One-time reference generation. gpt-4o-mini-tts shuts down on 2027-01-06.
 * Default is a dry run; --live explicitly enables paid calls. Prefer --only <id>.
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
  live?: boolean; apiKey?: string; fetchImpl?: typeof fetch;
};
type Result = { planned: number; generated: number; failed: string[] };
export async function generateReferenceAudio(options: Options = {}): Promise<Result> {
  const missionsPath = options.missionsPath ?? 'content/missions.json';
  const outputDir = options.outputDir ?? 'public/audio/missions';
  const missions = z.array(MissionSchema).parse(JSON.parse(await readFile(missionsPath, 'utf8')));
  if (options.only && !missions.some(mission => mission.id === options.only)) throw new Error('Unknown mission id');
  const selected = missions.filter(mission => (!options.only || mission.id === options.only) &&
    (options.force || !mission.referenceAudio || !existsSync(join(outputDir, `${mission.id}.mp3`))));
  const result: Result = { planned: selected.length, generated: 0, failed: [] };
  if (!options.live) return result;
  if (!options.apiKey) throw new Error('OPENAI_API_KEY is required for --live');
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { Authorization: `Bearer ${options.apiKey}` };
  await mkdir(outputDir, { recursive: true });

  for (const mission of selected) {
    let verified: Uint8Array | null = null;
    let similarity = 0;
    try {
      for (const voice of ['marin', 'cedar']) {
        const speech = await fetchImpl('https://api.openai.com/v1/audio/speech', {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000),
          body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice, input: mission.korean,
            instructions: 'Speak clear, natural Seoul Korean at a calm everyday pace, like a friendly university student.', response_format: 'mp3' }),
        });
        if (!speech.ok) throw new Error(`Speech request failed (${speech.status})`);
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
        if (!response.ok) throw new Error(`Transcription request failed (${response.status})`);
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
      console.info(`${mission.id}: FAIL (generation or verification did not complete)`);
    }
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.info('npm run content:audio -- [--only <id>] [--force] [--live]\nWithout --live: preview only, no API calls. Live mode makes up to four calls per selected mission.');
    return;
  }
  let only: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--only') { only = args[++i]; if (!only || only.startsWith('--')) throw new Error('--only needs a mission id'); }
    else if (!['--live', '--force'].includes(args[i])) throw new Error(`Unknown option: ${args[i]}`);
  }
  const live = args.includes('--live');
  if (live && !process.env.OPENAI_API_KEY && existsSync('.env.local')) process.loadEnvFile('.env.local');
  const result = await generateReferenceAudio({ only, live, force: args.includes('--force'), apiKey: process.env.OPENAI_API_KEY });
  console.info(live ? `${result.generated}/${result.planned} clips generated; ${result.failed.length} failed.` : `${result.planned} clips planned. Dry run: no API calls. Add --live to generate, preferably with --only <id>.`);
  if (result.failed.length) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Reference generation failed. Check options, the local API key, and the content file.'); process.exitCode = 1; });
}
