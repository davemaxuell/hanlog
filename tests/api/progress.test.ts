import { expect, it } from 'vitest';
import { GET as summary } from '@/app/api/progress/route';
import { GET as history } from '@/app/api/progress/attempts/route';
import { PUT as save, DELETE as unsave } from '@/app/api/progress/saved/[id]/route';
import { getDb } from '@/lib/db';
import { getProgressSummary } from '@/lib/repo/progress';
import { getMissions } from '@/lib/content';
import { ProgressSummarySchema } from '@/lib/progress-contracts';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call } from './_helpers';

useTestDb();
async function addAttempt(userId: string, missionId: string, overall: number, createdAt: string, scoredBy = 'ai') {
  return (await (await getDb()).query<{ id: string }>(`insert into hanlog.attempts (user_id,mission_id,overall,pronunciation,accuracy,usage,heard,feedback,scored_by,points_awarded,created_at)
    values ($1,$2,$3,$3,$3,$3,'test speech',$4,$5,0,$6) returning id`, [userId, missionId, overall, JSON.stringify({ issues: [], praise: 'Keep practising.', nextTip: 'Try the ending again.' }), scoredBy, createdAt]))[0].id;
}
it('returns an honest empty summary with seven Korea-time days', async () => {
  const { user } = await createTestUser();
  const body = ProgressSummarySchema.parse(await getProgressSummary(user.id, new Date('2026-11-16T00:00:00Z')));
  expect(body).toMatchObject({ totalAttempts: 0, practicedMissions: 0, strongMissions: 0, totalMissions: 24, practiceDays: 0, currentStreak: 0, longestStreak: 0, practicedToday: false, averageScore: null, recentAttempts: [], savedMissionIds: [] });
  expect(body.weeklyActivity).toHaveLength(7);
  expect(body.weeklyActivity.at(-1)).toEqual({ date: '2026-11-16', attempts: 0 });
  expect(getMissions().some(m => m.id === body.recommendedMissionId)).toBe(true);
});
it('counts zero-point practice and repeated attempts, while keeping progress owned', async () => {
  const owner = await createTestUser(); const other = await createTestUser();
  const missions = getMissions();
  await addAttempt(owner.user.id, missions[0].id, 20, '2026-11-15T14:59:00Z');
  await addAttempt(owner.user.id, missions[0].id, 80, '2026-11-15T15:01:00Z');
  await addAttempt(owner.user.id, missions[1].id, 60, '2026-11-15T16:00:00Z', 'mock');
  await addAttempt(other.user.id, missions[2].id, 100, '2026-11-15T16:00:00Z');
  const body = await getProgressSummary(owner.user.id, new Date('2026-11-16T00:00:00Z'));
  expect(body).toMatchObject({ totalAttempts: 3, practicedMissions: 2, strongMissions: 1, practiceDays: 2, currentStreak: 2, longestStreak: 2, practicedToday: true });
  expect(body.weeklyActivity.slice(-2).map(day => day.attempts)).toEqual([1, 2]);
  expect(body.recentAttempts.map(a => a.score.scoredBy)).toContain('mock');
  expect(body.recentAttempts).toHaveLength(3);
});
it('keeps yesterday streak alive and resets current streak after an idle day', async () => {
  const { user } = await createTestUser(); const id = getMissions()[0].id;
  for (const date of ['2026-11-10', '2026-11-11', '2026-11-14', '2026-11-15']) await addAttempt(user.id, id, 50, `${date}T00:00:00Z`);
  expect(await getProgressSummary(user.id, new Date('2026-11-16T00:00:00Z'))).toMatchObject({ currentStreak: 2, longestStreak: 2, practicedToday: false });
  expect(await getProgressSummary(user.id, new Date('2026-11-17T00:00:00Z'))).toMatchObject({ currentStreak: 0, longestStreak: 2 });
});
it('paginates tied timestamps stably and keeps mission filters and ownership', async () => {
  const owner = await createTestUser(); const other = await createTestUser(); const id = getMissions()[0].id;
  for (let i = 0; i < 4; i++) await addAttempt(owner.user.id, id, 50 + i, '2026-11-15T00:00:00Z');
  await addAttempt(owner.user.id, getMissions()[1].id, 99, '2026-11-15T00:00:00Z');
  await addAttempt(other.user.id, id, 100, '2026-11-15T00:00:00Z');
  const page = async (cursor = '') => (await call(history, makeRequest('GET', `/api/progress/attempts?missionId=${id}&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { cookie: owner.cookie }))).json();
  const first = await page(); const second = await page(first.nextCursor);
  expect(first.attempts).toHaveLength(2); expect(second.attempts).toHaveLength(2); expect(second.nextCursor).toBeNull();
  expect(new Set([...first.attempts, ...second.attempts].map(a => a.id)).size).toBe(4);
  expect(first.attempts[0].score.nextTip).toBe('Try the ending again.');
  expect((await call(history, makeRequest('GET', '/api/progress/attempts?cursor=garbage', { cookie: owner.cookie }))).status).toBe(400);
  expect((await call(history, makeRequest('GET', '/api/progress/attempts?limit=999', { cookie: owner.cookie }))).status).toBe(400);
});
it('saves only real missions idempotently for the signed-in profile', async () => {
  const owner = await createTestUser(); const other = await createTestUser(); const id = getMissions()[0].id;
  const mutate = (handler: typeof save, method: string, missionId = id) => call(handler, makeRequest(method, `/api/progress/saved/${missionId}`, { cookie: owner.cookie }), { id: missionId });
  expect((await mutate(save, 'PUT')).status).toBe(204);
  expect((await mutate(save, 'PUT')).status).toBe(204);
  expect((await getProgressSummary(owner.user.id)).savedMissionIds).toEqual([id]);
  expect((await getProgressSummary(other.user.id)).savedMissionIds).toEqual([]);
  expect((await mutate(save, 'PUT', 'missing-mission')).status).toBe(404);
  expect((await mutate(unsave, 'DELETE')).status).toBe(204);
  expect((await getProgressSummary(owner.user.id)).savedMissionIds).toEqual([]);
});
it('does not skip PostgreSQL microsecond timestamps between history pages', async () => {
  const { user, cookie } = await createTestUser(); const id = getMissions()[0].id;
  await addAttempt(user.id, id, 81, '2026-11-15T00:00:00.123001Z');
  await addAttempt(user.id, id, 82, '2026-11-15T00:00:00.123999Z');
  const first = await (await call(history, makeRequest('GET', '/api/progress/attempts?limit=1', { cookie }))).json();
  const second = await (await call(history, makeRequest('GET', `/api/progress/attempts?limit=1&cursor=${first.nextCursor}`, { cookie }))).json();
  expect(first.attempts.map((a: { score: { overall: number } }) => a.score.overall)).toEqual([82]);
  expect(second.attempts.map((a: { score: { overall: number } }) => a.score.overall)).toEqual([81]);
});
it('requires authentication for every progress endpoint', async () => {
  expect((await call(summary, makeRequest('GET', '/api/progress'))).status).toBe(401);
  expect((await call(history, makeRequest('GET', '/api/progress/attempts'))).status).toBe(401);
  expect((await call(save, makeRequest('PUT', '/api/progress/saved/cafe-iced-americano'), { id: 'cafe-iced-americano' })).status).toBe(401);
});
