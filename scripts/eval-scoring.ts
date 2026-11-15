import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getMission } from '../src/lib/content';
import { validateScoringWav, wavRms } from '../src/lib/audio/wav';
import { LIMITS } from '../src/lib/contracts';
import { composeScore } from '../src/lib/scoring/compose';
import { jamoSimilarity } from '../src/lib/scoring/jamo';
import { createOpenAiProvider } from '../src/lib/scoring/openai';
import { NoSpeechError } from '../src/lib/scoring/types';
import { FIXTURE_INDEX, type FixtureKind } from './gen-fixtures';

type Kind = FixtureKind | 'human-learner' | 'human-native' | 'latency';
export type EvaluationRow = {
  file: string; missionId: string; kind: Kind; run: number; durationMs: number; ms: number;
  outcome: 'scored' | 'no_speech' | 'failed'; overall: number | null; heard: string; similarity: number;
};
export type Check = { name: string; status: 'PASS' | 'FAIL' | 'INCOMPLETE' | 'SKIP'; detail: string };
const requiredChecks = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'use-ok', 'use-missing', 'latency'];
export function isEvaluationComplete(checks: Check[]): boolean {
  return checks.length === requiredChecks.length && requiredChecks.every(name => checks.filter(check => check.name === name && check.status === 'PASS').length === 1);
}
type Fixture = { file: string; missionId: string; kind: Kind; path: string };
export type FixtureDiagnostic = { file: string; status: 'ready' | 'missing' | 'invalid'; detail: string; durationMs?: number };
export function diagnoseFixtures(fixtures: Fixture[]): FixtureDiagnostic[] {
  return fixtures.map(fixture => {
    if (fixtures.filter(other => other.file === fixture.file).length !== 1) return { file: fixture.file, status: 'invalid', detail: 'Duplicate fixture entry.' };
    if (!getMission(fixture.missionId)) return { file: fixture.file, status: 'invalid', detail: 'Unknown mission.' };
    if (!existsSync(fixture.path)) return { file: fixture.file, status: 'missing', detail: 'Recording has not been supplied.' };
    try {
      const wav = new Uint8Array(readFileSync(fixture.path));
      const { durationMs } = validateScoringWav(wav);
      if (wavRms(wav) < LIMITS.silenceRms) return { file: fixture.file, status: 'invalid', detail: 'Silent fixture cannot test the model.', durationMs };
      if (fixture.kind === 'latency' && (durationMs < 9500 || durationMs > 10500)) return { file: fixture.file, status: 'invalid', detail: 'Latency fixture must be approximately ten seconds.', durationMs };
      return { file: fixture.file, status: 'ready', detail: 'WAV format and level valid; speech content is not independently verified.', durationMs };
    } catch { return { file: fixture.file, status: 'invalid', detail: 'Cannot read a valid scoring WAV.' }; }
  });
}
const mean = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length;
const complete = (rows: EvaluationRow[]) => rows.length > 0 && [...new Set(rows.map(r => r.file))].every(file => {
  const runs = rows.filter(r => r.file === file);
  return runs.length === 3 && [1, 2, 3].every(run => runs.some(r => r.run === run)) && runs.every(r => r.outcome !== 'failed');
});

export function evaluateRows(rows: EvaluationRow[]): Check[] {
  const checks: Check[] = [];
  const check = (name: string, subset: EvaluationRow[], predicate: (r: EvaluationRow) => boolean, minimumFiles = 1, minimumMissions = 1) => {
    const ready = complete(subset) && new Set(subset.map(r => r.file)).size >= minimumFiles && new Set(subset.map(r => r.missionId)).size >= minimumMissions;
    const failed = subset.some(r => r.outcome === 'failed' || !predicate(r));
    checks.push({ name, status: failed ? 'FAIL' : ready ? 'PASS' : 'INCOMPLETE', detail: `${subset.length} runs across ${new Set(subset.map(r => r.file)).size} files` });
  };
  const native = rows.filter(r => r.kind === 'native');
  check('A1', native, r => r.overall !== null && r.overall >= 80, 3, 3);
  check('A2', rows.filter(r => r.kind === 'wrong'), r => r.overall !== null && r.overall <= 49 && r.similarity < 0.6);
  check('A3', rows.filter(r => r.kind === 'noise'), r => r.outcome === 'no_speech');
  check('A4', rows.filter(r => r.kind === 'english'), r => r.overall !== null && r.overall <= 49);
  const scoredFiles = [...new Set(rows.filter(r => r.outcome === 'scored').map(r => r.file))];
  const stable = scoredFiles.length > 0 && scoredFiles.every(file => {
    const attempts = rows.filter(r => r.file === file);
    const scores = attempts.flatMap(r => r.overall === null ? [] : [r.overall]);
    return complete(attempts) && scores.length === 3 && Math.max(...scores) - Math.min(...scores) <= 10;
  });
  checks.push({ name: 'A5', status: rows.some(r => r.outcome === 'failed') ? 'FAIL' : !scoredFiles.length ? 'INCOMPLETE' : stable ? 'PASS' : 'FAIL', detail: `${scoredFiles.length} scored files; every file needs three stable scores` });
  const human = rows.filter(r => r.kind.startsWith('human-'));
  const learners = [...new Set(human.filter(r => r.kind === 'human-learner').map(r => r.file))];
  if (!human.length) checks.push({ name: 'A6', status: 'SKIP', detail: 'No consented human pairs supplied (H4).' });
  else {
    let lower = 0;
    let paired = 0;
    for (const file of learners) {
      const learner = human.filter(r => r.file === file);
      const reference = human.filter(r => r.kind === 'human-native' && r.missionId === learner[0].missionId);
      if (!complete(learner) || !complete(reference) || [...learner, ...reference].some(r => r.overall === null)) continue;
      paired++;
      if (mean(learner.map(r => r.overall!)) < mean(reference.map(r => r.overall!))) lower++;
    }
    checks.push({ name: 'A6', status: paired < 5 ? 'INCOMPLETE' : lower / paired >= 0.8 ? 'PASS' : 'FAIL', detail: `${lower}/${paired} learner/native pairs score lower; at least 5 pairs required` });
  }
  check('A7', rows.filter(r => r.kind === 'inject'), r => r.overall !== null && r.overall <= 49);
  check('use-ok', rows.filter(r => r.kind === 'use-ok'), r => r.overall !== null && r.overall >= 70);
  check('use-missing', rows.filter(r => r.kind === 'use-missing'), r => r.overall !== null && r.overall <= 49);
  const latency = rows.filter(r => r.kind === 'latency' && r.durationMs >= 9500 && r.durationMs <= 10500);
  const times = latency.map(r => r.ms).sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : null;
  const p95 = times.length ? times[Math.ceil(times.length * 0.95) - 1] : null;
  checks.push({ name: 'latency', status: !complete(latency) ? 'INCOMPLETE' : median! <= 6000 && p95! <= 12000 ? 'PASS' : 'FAIL', detail: `10-second clip: median ${median ?? 'unmeasured'}ms, p95 ${p95 ?? 'unmeasured'}ms` });
  return checks;
}

async function main() {
  const args = process.argv.slice(2);
  const folder = resolve('tests/fixtures/scoring');
  const fixtures: Fixture[] = FIXTURE_INDEX.map(f => ({ ...f, path: resolve(folder, f.file) }));
  const humanManifest = resolve(folder, 'human/index.json');
  if (existsSync(humanManifest)) {
    const human: unknown = JSON.parse(readFileSync(humanManifest, 'utf8'));
    if (!Array.isArray(human)) throw new Error('Human manifest must be an array.');
    for (const item of human as Record<string, unknown>[]) {
      if (typeof item.file !== 'string' || !/^[a-zA-Z0-9_.-]+\.wav$/.test(item.file) || typeof item.missionId !== 'string' || !['native', 'learner'].includes(String(item.kind))) throw new Error('Invalid human fixture manifest.');
      fixtures.push({ file: `human/${item.file}`, missionId: item.missionId, kind: item.kind === 'native' ? 'human-native' : 'human-learner', path: resolve(folder, 'human', item.file) });
    }
  }
  let latencyFile: string | undefined;
  let maxCalls = 0;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--latency-file' || args[i] === '--max-calls') {
      const option = args[i];
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`${option} needs a value.`);
      if (option === '--latency-file') latencyFile = value;
      else { maxCalls = Number(value); if (!Number.isSafeInteger(maxCalls) || maxCalls < 0) throw new Error('--max-calls must be a non-negative integer.'); }
    } else if (args[i] !== '--live') throw new Error(`Unknown option: ${args[i]}`);
  }
  if (latencyFile) fixtures.push({ file: 'latency-10s.wav', path: resolve(latencyFile), missionId: 'cafe-iced-americano', kind: 'latency' });
  const diagnostics = diagnoseFixtures(fixtures);
  const missing = diagnostics.filter(f => f.status === 'missing');
  const invalid = diagnostics.filter(f => f.status === 'invalid');
  const requestedCalls = fixtures.length * 3;
  console.info({ fixtures: fixtures.length, scoringRequests: requestedCalls, missing: missing.map(f => f.file), invalid: invalid.map(f => f.file), latencyFixture: !!latencyFile, humanCalibration: fixtures.some(f => f.kind === 'human-learner') ? 'Supplied; not yet evaluated.' : 'Missing; A6 remains unverified.' });
  console.table(diagnostics);
  if (!args.includes('--live')) {
    console.info('Dry run: zero requests made. Live evaluation requires all fixture files, --live, and explicit --max-calls.');
    return;
  }
  if (missing.length || invalid.length) throw new Error('Missing or invalid fixtures; no API request made. Resolve the diagnostics first.');
  if (!Number.isSafeInteger(maxCalls) || maxCalls < requestedCalls) throw new Error('Set --max-calls to cover the printed request count. No API request made.');
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is required for --live.');
  // Validate every input before spending on the first one.
  const prepared = fixtures.map(f => {
    const mission = getMission(f.missionId);
    if (!mission) throw new Error(`Unknown mission for ${f.file}.`);
    const wav = new Uint8Array(readFileSync(f.path));
    const { durationMs } = validateScoringWav(wav);
    if (f.kind === 'latency' && (durationMs < 9500 || durationMs > 10500)) throw new Error('Latency fixture must be approximately ten seconds.');
    return { ...f, mission, wav, durationMs };
  });
  const provider = createOpenAiProvider({ apiKey: key, model: process.env.OPENAI_SCORING_MODEL ?? 'gpt-audio-1.5', maxRetries: 0 });
  const rows: EvaluationRow[] = [];
  evaluation: for (const fixture of prepared) for (let run = 1; run <= 3; run++) {
    const started = performance.now();
    let overall: number | null = null;
    let heard = '';
    let outcome: EvaluationRow['outcome'] = 'scored';
    try {
      const raw = await provider.score({ wav: fixture.wav, mission: fixture.mission });
      heard = raw.heard;
      overall = composeScore(raw, fixture.mission, 'ai').overall;
    } catch (error) { outcome = error instanceof NoSpeechError ? 'no_speech' : 'failed'; }
    rows.push({ file: fixture.file, missionId: fixture.missionId, kind: fixture.kind, durationMs: fixture.durationMs, run, ms: Math.round(performance.now() - started), outcome, overall, heard, similarity: jamoSimilarity(heard, fixture.mission.korean) });
    if (outcome === 'failed') break evaluation; // Do not keep paying after a service failure.
  }
  const checks = evaluateRows(rows);
  console.table(rows);
  console.table(checks);
  const acceptanceComplete = isEvaluationComplete(checks);
  mkdirSync('docs/spike', { recursive: true });
  writeFileSync('docs/spike/latest-evaluation.json', JSON.stringify({ date: new Date().toISOString(), acceptanceComplete, rows, checks }, null, 2) + '\n');
  if (!acceptanceComplete) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : 'Evaluation failed.'); process.exitCode = 1; });
}
