import { expect, it } from 'vitest';
import { jamoSimilarity, normalizeHangul } from '@/lib/scoring/jamo';

const target = '아이스 아메리카노 한 잔 주세요';
it('normalizes', () => { expect(normalizeHangul('대박, 이 노래 ABC 12!')).toBe('대박이노래'); });
it('is 1 for the same syllables regardless of spacing and punctuation', () => {
  expect(jamoSimilarity('안녕하세요.', ' 안녕 하세요!')).toBe(1);
});
it('stays high for near misses', () => {
  // the target is 28 jamo tokens
  expect(jamoSimilarity('아이스 아메리카노 한 잔 주세여', target)).toBeCloseTo(27 / 28, 5); // one vowel substituted
  expect(jamoSimilarity('아이스 아메리카노 한 자 주세요', target)).toBeCloseTo(27 / 28, 5); // one final consonant dropped
  expect(jamoSimilarity('아이스 아메리카노 주세요', target)).toBeCloseTo(22 / 28, 5);       // two words missing
});
it('falls below the gate for half or unrelated sentences', () => {
  expect(jamoSimilarity('아이스 아메리카노', target)).toBeCloseTo(16 / 28, 5);
  expect(jamoSimilarity('감사합니다', target)).toBeLessThan(0.45);
  expect(jamoSimilarity('만나서 반갑습니다', '감사합니다')).toBeCloseTo(9 / 20, 5);
});
it('is 0 when either side has no Hangul', () => {
  expect(jamoSimilarity('', '안녕')).toBe(0);
  expect(jamoSimilarity('hello', '안녕')).toBe(0);
  expect(jamoSimilarity('', '')).toBe(0);
});
it('does not confuse an initial with a final of the same letter', () => {
  expect(jamoSimilarity('가', '악')).toBeLessThan(1);
});
