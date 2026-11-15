import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import { SHARE_CODE_ALPHABET } from '@/lib/contracts';
import { getMissions, getRewards, getSampleChallenges } from '@/lib/content';
import { jamoSimilarity, normalizeHangul } from '@/lib/scoring/jamo';

const missions = getMissions();
const syllables = (s: string) => [...normalizeHangul(s)].length;
const TAGS = ['cafe', 'store', 'food', 'campus', 'transit', 'shopping', 'friends', 'fandom', 'slang', 'housing'];
const BANNED = /\bBTS\b|방탄|블랙핑크|스타벅스|삼성|카카오|네이버|쿠팡|배민|SM엔터|하이브|\bTOPIK\b|토픽/i; // a tripwire, not a full list: the human review is the real check

it('has the planned shape', () => {
  expect(missions).toHaveLength(24);
  expect([1, 2, 3].map((l) => missions.filter((m) => m.level === l).length)).toEqual([12, 8, 4]);
  expect(missions.filter((m) => m.mode === 'use').length).toBeGreaterThanOrEqual(6);
  expect(new Set(missions.map((m) => m.id)).size).toBe(24);
});
it('keeps the seed missions untouched', () => {
  const seed = (id: string) => missions.find((m) => m.id === id)!;
  expect(seed('cafe-iced-americano')).toMatchObject({ korean: '아이스 아메리카노 한 잔 주세요.', level: 1, mode: 'repeat' });
  expect(seed('greet-nice-to-meet').korean).toBe('만나서 반갑습니다.');
  expect(seed('store-no-receipt').korean).toBe('영수증은 버려 주세요.');
  expect(seed('transit-this-stop').korean).toBe('이번 역에서 내려요.');
  expect(seed('slang-daebak')).toMatchObject({ mode: 'use', keyword: '대박' });
  expect(seed('campus-group-roles').korean).toBe('조별 과제 역할을 어떻게 나눌까요?');
});
it('keeps h at noun boundaries in Revised Romanization', () => {
  expect(missions.find(mission => mission.id === 'daily-sohwakhaeng')!.romanization).toContain('sohwakhaengieyo');
  expect(missions.find(mission => mission.id === 'campus-group-roles')!.romanization).toContain('yeokhareul');
});
it.each(missions)('$id follows the writing rules', (m) => {
  expect(m.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  expect(m.korean).not.toMatch(/[0-9A-Za-z]/);
  expect(m.romanization).toMatch(/^[a-z ,.'?!-]+$/);
  expect(m.basePoints).toBe(m.level * 10);
  expect(m.tags.length).toBeGreaterThan(0);
  expect(m.tags.every((t) => TAGS.includes(t))).toBe(true);
  for (const text of [m.korean, m.meaningEn, m.situationEn, m.promptEn]) expect(text).not.toMatch(BANNED);
  expect(m.meaningEn.length).toBeGreaterThan(0);
  expect(m.meaningEn.length).toBeLessThanOrEqual(120);
  expect(m.situationEn.length).toBeGreaterThan(0);
  expect(m.situationEn.length).toBeLessThanOrEqual(160);
  expect(m.promptEn.length).toBeLessThanOrEqual(120);
  if (m.mode === 'repeat') {
    expect(syllables(m.korean)).toBeGreaterThanOrEqual(4);
    expect(syllables(m.korean)).toBeLessThanOrEqual(25);
  } else {
    expect(syllables(m.keyword!)).toBeGreaterThanOrEqual(1);
    expect(syllables(m.keyword!)).toBeLessThanOrEqual(6);
    expect(normalizeHangul(m.korean)).toContain(normalizeHangul(m.keyword!));
    expect(m.promptEn).toContain(m.keyword!);
  }
  if (m.referenceAudio !== null) {
    expect(m.referenceAudio).toBe(`/audio/missions/${m.id}.mp3`);
    expect(existsSync(`public${m.referenceAudio}`)).toBe(true);
  }
});
it('has no near-duplicate sentences and no repeated keywords', () => {
  for (let i = 0; i < missions.length; i++)
    for (let j = i + 1; j < missions.length; j++)
      expect(jamoSimilarity(missions[i].korean, missions[j].korean), `${missions[i].id} vs ${missions[j].id}`).toBeLessThan(0.8);
  const keywords = missions.filter((m) => m.keyword).map((m) => m.keyword);
  expect(new Set(keywords).size).toBe(keywords.length);
});
it('has eight sample challenges that follow the rules', () => {
  const samples = getSampleChallenges();
  expect(samples).toHaveLength(8);
  expect(samples.slice(0, 2).map((s) => s.code)).toEqual(['SMPL22', 'SMPL23']);
  expect(new Set(samples.map((s) => s.code)).size).toBe(8);
  for (const s of samples) {
    expect(s.code).toHaveLength(6);
    expect([...s.code].every((ch) => SHARE_CODE_ALPHABET.includes(ch))).toBe(true);
    expect(syllables(s.korean)).toBeGreaterThan(0);
    expect([...s.korean].length).toBeLessThanOrEqual(60);
    expect(s.meaningEn.length).toBeGreaterThan(0);
    expect(s.meaningEn.length).toBeLessThanOrEqual(120);
    expect(s.situationEn.length).toBeLessThanOrEqual(200);
    for (const text of [s.korean, s.meaningEn, s.situationEn]) expect(text).not.toMatch(BANNED);
  }
});
it('leaves the rewards catalog alone', () => {
  expect(getRewards().map((r) => [r.id, r.cost])).toEqual([['kpop-album', 3000], ['kpop-photocard', 1200], ['grocery-10000', 1000], ['fashion-10', 800], ['cvs-5000', 500], ['cafe-drink', 400]]);
});
