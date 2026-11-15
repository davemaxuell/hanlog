import { expect, it } from 'vitest';
import { SHARE_CODE_ALPHABET } from '@/lib/contracts';
import { getMission, getMissions, getRewards, getSampleChallenges, todaysMissionIds } from '@/lib/content';

it('loads valid content', () => {
  expect(getMissions().length).toBeGreaterThanOrEqual(6);
  expect(new Set(getMissions().map((m) => m.id)).size).toBe(getMissions().length);
  expect(getMission('cafe-iced-americano')).toMatchObject({ mode: 'repeat', basePoints: 10, keyword: null });
  expect(getMission('slang-daebak')).toMatchObject({ mode: 'use', keyword: '대박' });
  expect(getMission('nope')).toBeNull();
  expect(getRewards().map((r) => r.cost)).toEqual([3000, 1200, 1000, 800, 500, 400]);
  for (const s of getSampleChallenges()) {
    expect(s.code).toHaveLength(6);
    expect([...s.code].every((ch) => SHARE_CODE_ALPHABET.includes(ch))).toBe(true);
  }
});
it("picks today's missions deterministically, one per level", () => {
  const ids = todaysMissionIds('2026-11-15');
  expect(ids).toHaveLength(3);
  expect(ids.map((id) => getMission(id)!.level)).toEqual([1, 2, 3]);
  expect(todaysMissionIds('2026-11-15')).toEqual(ids);
  const level1 = getMissions().filter((m) => m.level === 1);
  // 2026-11-15 is day 319 of the year
  expect(ids[0]).toBe(level1[319 % level1.length].id);
  expect(todaysMissionIds('2026-01-01')[0]).toBe(level1[1 % level1.length].id);
});
