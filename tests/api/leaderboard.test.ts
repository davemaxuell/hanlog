import { expect, it } from 'vitest';
import { GET as leaderboard } from '@/app/api/leaderboard/route';
import { PUT as visibility } from '@/app/api/leaderboard/visibility/route';
import { getDb } from '@/lib/db';
import { kstDayStartIso } from '@/lib/http';
import { LeaderboardSchema } from '@/lib/social-contracts';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call } from './_helpers';

useTestDb();
async function award(userId: string, delta: number, at = new Date().toISOString()) {
  await (await getDb()).query("insert into hanlog.point_events (user_id, delta, reason, ref_id, label, created_at) values ($1,$2,'mission','test','Test',$3)", [userId, delta, at]);
}
async function attempt(userId: string, missionId: string, overall: number) {
  await (await getDb()).query(`insert into hanlog.attempts (user_id, mission_id, overall, pronunciation, accuracy, usage, heard, feedback, scored_by)
    values ($1,$2,$3,$3,$3,$3,'',$4,'mock')`, [userId, missionId, overall, JSON.stringify({ issues: [], praise: '', nextTip: '' })]);
}
async function board(cookie: string, period = 'all') {
  const res = await call(leaderboard, makeRequest('GET', `/api/leaderboard?period=${period}`, { cookie }));
  expect(res.status).toBe(200);
  return LeaderboardSchema.parse(await res.json());
}

it('ranks everyone with points, shares ranks on ties, and marks the viewer', async () => {
  const mina = await createTestUser('learner', 'Mina'); const joon = await createTestUser('korean', 'Joon');
  const leo = await createTestUser('learner', 'Leo'); await createTestUser('learner', 'Quiet');
  await award(mina.user.id, 40); await award(joon.user.id, 25); await award(leo.user.id, 25);
  await attempt(mina.user.id, 'cafe-iced-americano', 70); await attempt(mina.user.id, 'cafe-iced-americano', 90); await attempt(mina.user.id, 'greet-nice-to-meet', 80);
  const result = await board(leo.cookie);
  expect(result.entries.map(entry => [entry.rank, entry.nickname, entry.points])).toEqual([[1, 'Mina', 40], [2, 'Joon', 25], [2, 'Leo', 25]]);
  expect(result.entries[0]).toMatchObject({ practised: 2, averageScore: 85, role: 'learner', isMe: false });
  expect(result.entries.find(entry => entry.nickname === 'Leo')?.isMe).toBe(true);
  expect(result.me).toEqual({ rank: 2, points: 25, visible: true });
});

it('counts only points earned since midnight Korea time for today', async () => {
  const early = await createTestUser('learner', 'Early'); const fresh = await createTestUser('learner', 'Fresh');
  await award(early.user.id, 100, new Date(new Date(kstDayStartIso()).getTime() - 60_000).toISOString());
  await award(early.user.id, 5); await award(fresh.user.id, 20);
  const today = await board(fresh.cookie, 'today');
  expect(today.period).toBe('today');
  expect(today.entries.map(entry => [entry.nickname, entry.points])).toEqual([['Fresh', 20], ['Early', 5]]);
  expect((await board(fresh.cookie, 'all')).entries[0].nickname).toBe('Early');
});

it('lets people hide from leaderboards while still seeing their own total', async () => {
  const shy = await createTestUser('learner', 'Shy'); const other = await createTestUser('learner', 'Other');
  await award(shy.user.id, 50); await award(other.user.id, 10);
  const hide = await call(visibility, makeRequest('PUT', '/api/leaderboard/visibility', { cookie: shy.cookie, json: { visible: false } }));
  expect(hide.status).toBe(200);
  expect((await board(other.cookie)).entries.map(entry => entry.nickname)).toEqual(['Other']);
  expect((await board(shy.cookie)).me).toEqual({ rank: null, points: 50, visible: false });
  await call(visibility, makeRequest('PUT', '/api/leaderboard/visibility', { cookie: shy.cookie, json: { visible: true } }));
  expect((await board(other.cookie)).entries[0]).toMatchObject({ nickname: 'Shy', rank: 1 });
});

it('requires a profile and a valid period', async () => {
  expect((await call(leaderboard, makeRequest('GET', '/api/leaderboard'))).status).toBe(401);
  const viewer = await createTestUser();
  expect((await call(leaderboard, makeRequest('GET', '/api/leaderboard?period=year', { cookie: viewer.cookie }))).status).toBe(400);
  expect((await call(visibility, makeRequest('PUT', '/api/leaderboard/visibility', { cookie: viewer.cookie, json: { visible: 'yes' } }))).status).toBe(400);
});
