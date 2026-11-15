import { expect, it } from 'vitest';
import { GET as missions } from '@/app/api/missions/route';
import { GET as points } from '@/app/api/points/route';
import { GET as rewards } from '@/app/api/rewards/route';
import { getMission, getMissions } from '@/lib/content';
import { recordAttempt } from '@/lib/repo/attempts';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call } from './_helpers';

useTestDb();
it('lists missions for a visitor with empty progress', async () => {
  const body = await (await call(missions, makeRequest('GET', '/api/missions'))).json();
  expect(body.missions).toHaveLength(getMissions().length);
  expect(body.missions[0]).toMatchObject({ id: getMissions()[0].id, bestOverall: null, pointsEarned: 0 });
  expect(body.today).toHaveLength(3);
});
it('includes progress for the signed-in user', async () => {
  const { user, cookie } = await createTestUser();
  const m = getMission('cafe-iced-americano')!;
  await recordAttempt({ userId: user.id, mission: m, score: { overall: 88, pronunciation: 88, accuracy: 88, usage: 88, heard: 'h', issues: [], praise: 'p', nextTip: 't', scoredBy: 'mock' } });
  const body = await (await call(missions, makeRequest('GET', '/api/missions', { cookie }))).json();
  expect(body.missions.find((x: { id: string }) => x.id === m.id)).toMatchObject({ bestOverall: 88, pointsEarned: 10 });
  expect(await (await call(points, makeRequest('GET', '/api/points', { cookie }))).json()).toMatchObject({ balance: 10 });
});
it('guards points and serves the reward catalog', async () => {
  expect((await call(points, makeRequest('GET', '/api/points'))).status).toBe(401);
  const body = await (await call(rewards, makeRequest('GET', '/api/rewards'))).json();
  expect(body.rewards.map((r: { id: string }) => r.id)).toEqual(['kpop-album', 'kpop-photocard', 'grocery-10000', 'fashion-10', 'cvs-5000', 'cafe-drink']);
});
