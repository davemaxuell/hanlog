import { expect, it } from 'vitest';
import { getMission } from '@/lib/content';
import { composeScore } from '@/lib/scoring/compose';
import { NoSpeechError, type RawScore } from '@/lib/scoring/types';

const repeat = getMission('cafe-iced-americano')!;
const use = getMission('slang-daebak')!;
const raw = (o: Partial<RawScore> = {}): RawScore =>
  ({ speechDetected: true, heard: repeat.korean, pronunciation: 84, accuracy: 96, usage: 88, issues: [], praise: 'p', nextTip: 't', ...o });

it('weights by mode', () => {
  expect(composeScore(raw(), repeat, 'mock')).toMatchObject({ overall: 88, pronunciation: 84, accuracy: 96, usage: 88, scoredBy: 'mock' });
  expect(composeScore(raw({ heard: use.korean }), use, 'ai')).toMatchObject({ overall: 89, scoredBy: 'ai' });
});
it('throws when nothing was said', () => {
  expect(() => composeScore(raw({ speechDetected: false }), repeat, 'ai')).toThrow(NoSpeechError);
  expect(() => composeScore(raw({ heard: '   ' }), repeat, 'ai')).toThrow(NoSpeechError);
});
it('never pays for a different sentence, whatever the model claims', () => {
  const s = composeScore(raw({ heard: '감사합니다', pronunciation: 100, accuracy: 100, usage: 100 }), repeat, 'ai');
  expect(s.accuracy).toBeLessThanOrEqual(55);
  expect(s.overall).toBeLessThanOrEqual(49);
});
it('keeps near misses above the gate', () => {
  const s = composeScore(raw({ heard: '아이스 아메리카노 한 잔 주세여' }), repeat, 'ai');
  expect(s.accuracy).toBe(96);
  expect(s.overall).toBe(88);
});
it('caps accuracy by similarity plus ten', () => {
  const s = composeScore(raw({ heard: '아이스 아메리카노 주세요', accuracy: 100 }), repeat, 'ai'); // similarity 0.79
  expect(s.accuracy).toBe(89);
});
it('requires the keyword in use mode', () => {
  const s = composeScore(raw({ heard: '이 노래 진짜 좋다', pronunciation: 100, accuracy: 100, usage: 100 }), use, 'ai');
  expect(s.accuracy).toBe(40);
  expect(s.overall).toBeLessThanOrEqual(49);
});
it('clamps, rounds, and trims', () => {
  const long = 'x'.repeat(500);
  const s = composeScore(raw({
    pronunciation: 140, accuracy: -5, usage: 83.6,
    issues: Array.from({ length: 5 }, () => ({ segment: ' 잔 ', problem: long, tip: long })),
    praise: long, nextTip: long,
  }), use, 'ai');
  expect([s.pronunciation, s.accuracy, s.usage]).toEqual([100, 0, 84]);
  expect(s.issues).toHaveLength(3);
  expect(s.issues[0].segment).toBe('잔');
  expect(s.issues[0].problem).toHaveLength(200);
  expect(s.praise).toHaveLength(240);
  expect(s.nextTip).toHaveLength(240);
});
