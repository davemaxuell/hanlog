import { expect, it } from 'vitest';
import { evaluateRows, isEvaluationComplete, diagnoseFixtures, type EvaluationRow, type Check } from '../../../scripts/eval-scoring';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toneWav } from '../../helpers/audio';

function runs(kind: EvaluationRow['kind'], file: string = kind, overall = 90, missionId = file): EvaluationRow[] {
  return [1, 2, 3].map(run => ({ file, missionId, kind, run, durationMs: 3000, ms: 4000, outcome: 'scored', overall, heard: 'fixture', similarity: 1 }));
}
const status = (rows: EvaluationRow[], name: string) => evaluateRows(rows).find(check => check.name === name)?.status;

it('does not claim empty or single-case evidence meets the thresholds', () => {
  expect(evaluateRows([]).filter(check => check.status === 'PASS')).toEqual([]);
  expect(status(runs('native'), 'A1')).toBe('INCOMPLETE');
  expect(status(runs('native').slice(0, 1), 'A5')).not.toBe('PASS');
  expect(status([], 'A6')).toBe('SKIP');
});
it('checks all native missions and both wrong-sentence safeguards', () => {
  const native = ['cafe', 'bus', 'shop'].flatMap(file => runs('native', file));
  expect(status(native, 'A1')).toBe('PASS');
  native[4].overall = 79;
  expect(status(native, 'A1')).toBe('FAIL');
  const wrong = runs('wrong', 'wrong', 49).map(row => ({ ...row, similarity: 0.4 }));
  expect(status(wrong, 'A2')).toBe('PASS');
  wrong[1].similarity = 0.6;
  expect(status(wrong, 'A2')).toBe('FAIL');
});
it('separates noise rejection, score stability, and ten-second latency evidence', () => {
  const noise = runs('noise').map(row => ({ ...row, outcome: 'no_speech' as const, overall: null }));
  expect(status(noise, 'A3')).toBe('PASS');
  const scores = runs('accent');
  scores[1].overall = 79;
  expect(status(scores, 'A5')).toBe('FAIL');
  const latency = runs('latency');
  expect(status(latency, 'latency')).toBe('INCOMPLETE');
  expect(status(latency.map(row => ({ ...row, durationMs: 10000 })), 'latency')).toBe('PASS');
});
it('requires five human pairs and at least eighty percent lower learner scores', () => {
  const pairs = Array.from({ length: 5 }, (_, index) => [
    ...runs('human-native', `native-${index}`, 90, String(index)),
    ...runs('human-learner', `learner-${index}`, index === 0 ? 95 : 70, String(index)),
  ]).flat();
  expect(status(pairs, 'A6')).toBe('PASS');
  expect(status(pairs.slice(0, 24), 'A6')).toBe('INCOMPLETE');
  pairs.filter(row => row.file === 'learner-1').forEach(row => { row.overall = 95; });
  expect(status(pairs, 'A6')).toBe('FAIL');
});
it('does not certify a run with skipped calibration or missing acceptance checks', () => {
  const checks: Check[] = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'use-ok', 'use-missing', 'latency'].map(name => ({ name, status: 'PASS', detail: '' }));
  expect(isEvaluationComplete(checks)).toBe(true);
  checks.find(check => check.name === 'A6')!.status = 'SKIP';
  expect(isEvaluationComplete(checks)).toBe(false);
  expect(isEvaluationComplete(checks.filter(check => check.name !== 'A6'))).toBe(false);
  expect(isEvaluationComplete([])).toBe(false);
});
it('preserves observed failures even before all repetitions or missions finish', () => {
  expect(status(runs('native').slice(0, 1).map(row => ({ ...row, overall: 40 })), 'A1')).toBe('FAIL');
  const rows = [...runs('native'), { ...runs('accent')[0], outcome: 'failed' as const, overall: null }];
  expect(status(rows, 'A5')).not.toBe('PASS');
});
it('diagnoses missing, corrupt, silent and short latency fixtures without requests', () => {
  const folder = mkdtempSync(join(tmpdir(), 'hanlog-eval-'));
  try {
    writeFileSync(join(folder, 'valid.wav'), toneWav(1000));
    writeFileSync(join(folder, 'corrupt.wav'), new Uint8Array(1000));
    writeFileSync(join(folder, 'silent.wav'), toneWav(1000, { amplitude: 0 }));
    const fixtures = ['valid', 'corrupt', 'missing', 'silent'].map(file => ({ file: `${file}.wav`, path: join(folder, `${file}.wav`), missionId: 'cafe-iced-americano', kind: 'native' as const }));
    expect(diagnoseFixtures(fixtures).map(item => item.status)).toEqual(['ready', 'invalid', 'missing', 'invalid']);
    expect(diagnoseFixtures([{ ...fixtures[0], kind: 'latency' }])[0].status).toBe('invalid');
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
