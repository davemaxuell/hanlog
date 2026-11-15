import { expect, it } from 'vitest';
import type { Score } from '@/lib/contracts';
import { getMission } from '@/lib/content';
import { missionProgress, recordAttempt } from '@/lib/repo/attempts';
import { getPoints } from '@/lib/repo/points';
import { createTestUser, useTestDb } from '../helpers/api';

useTestDb();
const score = (overall: number): Score => ({ overall, pronunciation: overall, accuracy: overall, usage: overall, heard: 'h', issues: [], praise: 'p', nextTip: 't', scoredBy: 'mock' });
const L1 = getMission('cafe-iced-americano')!, L2 = getMission('store-no-receipt')!, L3 = getMission('campus-group-roles')!;

it('pays once per mission, up to its base points', async () => {
  const { user } = await createTestUser();
  expect(await recordAttempt({ userId: user.id, mission: L1, score: score(88) })).toMatchObject({ attempt: { pointsAwarded: 10, missionId: L1.id }, balance: 10, bestOverall: 88 });
  expect(await recordAttempt({ userId: user.id, mission: L1, score: score(95) })).toMatchObject({ attempt: { pointsAwarded: 0 }, balance: 10, bestOverall: 95 });
});
it('pays only the improvement', async () => {
  const { user } = await createTestUser();
  expect((await recordAttempt({ userId: user.id, mission: L2, score: score(72) })).attempt.pointsAwarded).toBe(12);
  expect((await recordAttempt({ userId: user.id, mission: L2, score: score(90) })).attempt.pointsAwarded).toBe(8);
  expect(await recordAttempt({ userId: user.id, mission: L2, score: score(60) })).toMatchObject({ attempt: { pointsAwarded: 0 }, balance: 20, bestOverall: 90 });
  expect(await missionProgress(user.id)).toEqual({ [L2.id]: { bestOverall: 90, pointsEarned: 20 } });
});
it('does not double pay simultaneous attempts', async () => {
  const { user } = await createTestUser();
  const results = await Promise.all([1, 2, 3].map(() => recordAttempt({ userId: user.id, mission: L3, score: score(90) })));
  expect(results.reduce((sum, r) => sum + r.attempt.pointsAwarded, 0)).toBe(30);
  expect((await getPoints(user.id)).balance).toBe(30);
});
it('reports the ledger newest first with spec labels', async () => {
  const { user } = await createTestUser();
  await recordAttempt({ userId: user.id, mission: L1, score: score(88) });
  await recordAttempt({ userId: user.id, mission: L2, score: score(40) });   // no points, no event
  await recordAttempt({ userId: user.id, mission: L3, score: score(88) });
  const { balance, events } = await getPoints(user.id);
  expect(balance).toBe(40);
  expect(events.map((e) => [e.delta, e.reason, e.label])).toEqual([[30, 'mission', `Mission: ${L3.korean}`], [10, 'mission', `Mission: ${L1.korean}`]]);
  expect(await getPoints('3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11')).toEqual({ balance: 0, events: [] });
});
it('stores the score so it reads back identically', async () => {
  const { user } = await createTestUser();
  const s = { ...score(77), heard: '아이스', issues: [{ segment: '잔', problem: 'a', tip: 'b' }] };
  expect((await recordAttempt({ userId: user.id, mission: L1, score: s })).attempt.score).toEqual(s);
});
