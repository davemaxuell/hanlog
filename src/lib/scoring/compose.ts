import type { Mission, Score } from '../contracts';
import { jamoSimilarity, normalizeHangul } from './jamo';
import { NoSpeechError, ScoringFailedError, type RawScore } from './types';
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const trim = (s: string, max: number) => Array.from(s.trim()).slice(0, max).join('');
export function composeScore(raw: RawScore, mission: Mission, scoredBy: 'ai' | 'mock'): Score {
  if (!raw.speechDetected || !raw.heard.trim()) throw new NoSpeechError();
  if (![raw.pronunciation, raw.accuracy, raw.usage].every(Number.isFinite)) throw new ScoringFailedError();
  const pronunciation = clamp(raw.pronunciation), usage = clamp(raw.usage);
  let accuracy = clamp(raw.accuracy);
  const similarity = mission.mode === 'repeat' ? jamoSimilarity(raw.heard, mission.korean) : 1;
  const keyword = normalizeHangul(mission.keyword ?? '');
  const hasKeyword = mission.mode === 'repeat' || (!!keyword && normalizeHangul(raw.heard).includes(keyword));
  if (mission.mode === 'repeat') accuracy = Math.min(accuracy, clamp(similarity * 100 + 10));
  else if (!hasKeyword) accuracy = Math.min(accuracy, 40);
  const weights = mission.mode === 'repeat' ? [0.5, 0.3, 0.2] : [0.35, 0.25, 0.4];
  let overall = Math.round(pronunciation * weights[0] + accuracy * weights[1] + usage * weights[2]);
  if (similarity < 0.6 || !hasKeyword) overall = Math.min(overall, 49);
  return { overall, pronunciation, accuracy, usage, heard: raw.heard.trim(),
    issues: raw.issues.slice(0, 3).map(issue => ({ segment: trim(issue.segment, 200), problem: trim(issue.problem, 200), tip: trim(issue.tip, 200) })),
    praise: trim(raw.praise, 240), nextTip: trim(raw.nextTip, 240), scoredBy };
}
