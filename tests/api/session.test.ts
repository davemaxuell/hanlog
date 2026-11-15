import { afterEach, expect, it, vi } from 'vitest';
import { GET, PATCH, POST } from '@/app/api/session/route';
import { getDb } from '@/lib/db';
import { deleteUserCascade } from '@/lib/repo/users';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, cookieFrom } from './_helpers';

useTestDb();
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });
const users = async () => (await (await getDb()).query<{ n: number }>(`select count(*)::int as n from hanlog.users where ip_hash <> 'system'`))[0].n;
const create = (json: unknown, opts = {}) => call(POST, makeRequest('POST', '/api/session', { json, ...opts }));

it('reports no user without a cookie', async () => {
  expect(await (await call(GET, makeRequest('GET', '/api/session'))).json()).toEqual({ user: null });
});
it('creates a user and a cookie that works', async () => {
  const res = await create({ nickname: '  아이샤 ', role: 'learner', consent: true });
  expect(res.status).toBe(201);
  const { user } = await res.json();
  expect(user).toMatchObject({ nickname: '아이샤', role: 'learner' });
  expect((await (await call(GET, makeRequest('GET', '/api/session', { cookie: cookieFrom(res) }))).json()).user.id).toBe(user.id);
});
it('returns the existing user instead of creating a second one', async () => {
  const { user, cookie } = await createTestUser();
  const res = await create({ nickname: 'Other', role: 'korean', consent: true }, { cookie });
  expect(res.status).toBe(200);
  expect((await res.json()).user.id).toBe(user.id);
  expect(await users()).toBe(1);
});
it('rejects bad input', async () => {
  expect((await create({ nickname: 'a', role: 'learner', consent: true })).status).toBe(400);
  expect((await create({ nickname: 'Aisha', role: 'learner', consent: false })).status).toBe(400);
  expect((await create('not an object')).status).toBe(400);
  const linky = await create({ nickname: 'www.spam.co', role: 'learner', consent: true });
  expect([linky.status, (await linky.json()).error.code]).toEqual([422, 'content_rejected']);
  expect(await users()).toBe(0);
});
it('refuses cross-origin writes', async () => {
  expect((await create({ nickname: 'Aisha', role: 'learner', consent: true }, { headers: { origin: 'https://evil.test' } })).status).toBe(403);
});
it('caps new users per address per day', async () => {
  vi.stubEnv('IP_DAILY_SESSIONS', '1');
  const headers = { 'x-forwarded-for': '7.7.7.7' };
  expect((await create({ nickname: 'One', role: 'learner', consent: true }, { headers })).status).toBe(201);
  const second = await create({ nickname: 'Two', role: 'learner', consent: true }, { headers });
  expect([second.status, (await second.json()).error.code]).toEqual([429, 'daily_limit']);
});
it('retains the daily creation limit after deleting the created profile', async () => {
  vi.stubEnv('IP_DAILY_SESSIONS', '1');
  const headers = { 'x-forwarded-for': '203.0.113.71' };
  const first = await create({ nickname: 'First', role: 'learner', consent: true }, { headers });
  expect(first.status).toBe(201);
  await deleteUserCascade((await first.json()).user.id);
  const second = await create({ nickname: 'Again', role: 'learner', consent: true }, { headers });
  expect([second.status, (await second.json()).error?.code]).toEqual([429, 'daily_limit']);
  expect(await users()).toBe(0);
});
it('starts a fresh creation quota at midnight in Korea', async () => {
  vi.stubEnv('IP_DAILY_SESSIONS', '1');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-15T14:59:59Z'));
  const headers = { 'x-forwarded-for': '203.0.113.72' };
  expect((await create({ nickname: 'Before', role: 'learner', consent: true }, { headers })).status).toBe(201);
  expect((await create({ nickname: 'Blocked', role: 'learner', consent: true }, { headers })).status).toBe(429);
  vi.setSystemTime(new Date('2026-11-15T15:00:00Z'));
  expect((await create({ nickname: 'After', role: 'learner', consent: true }, { headers })).status).toBe(201);
  expect(await (await getDb()).query('select day::text,sessions from hanlog.session_creation_limits order by day')).toEqual([
    { day: '2026-11-15', sessions: 1 }, { day: '2026-11-16', sessions: 1 },
  ]);
});
it('rolls back the creation quota if the profile insert fails', async () => {
  vi.stubEnv('IP_DAILY_SESSIONS', '1');
  const db = await getDb();
  const transaction = db.tx.bind(db);
  let failed = false;
  vi.spyOn(db, 'tx').mockImplementation(fn => transaction(tx => fn({
    ...tx,
    query: async (sql, params) => {
      if (!failed && sql.startsWith('insert into hanlog.users')) { failed = true; throw new Error('Simulated insert failure'); }
      return tx.query(sql, params);
    },
  })));
  const headers = { 'x-forwarded-for': '203.0.113.73' };
  expect((await create({ nickname: 'First', role: 'learner', consent: true }, { headers })).status).toBe(500);
  expect((await create({ nickname: 'Retry', role: 'learner', consent: true }, { headers })).status).toBe(201);
  expect(await db.query('select sessions from hanlog.session_creation_limits')).toEqual([{ sessions: 1 }]);
});
it('updates nickname and role', async () => {
  const { cookie } = await createTestUser('learner', 'Aisha');
  const res = await call(PATCH, makeRequest('PATCH', '/api/session', { cookie, json: { role: 'korean' } }));
  expect((await res.json()).user).toMatchObject({ nickname: 'Aisha', role: 'korean' });
  expect((await call(PATCH, makeRequest('PATCH', '/api/session', { cookie, json: {} }))).status).toBe(400);
  expect((await call(PATCH, makeRequest('PATCH', '/api/session', { json: { role: 'korean' } }))).status).toBe(401);
});

it('keeps the session cap atomic under simultaneous requests', async () => {
  vi.stubEnv('IP_DAILY_SESSIONS', '2');
  const responses = await Promise.all(Array.from({ length: 5 }, (_, i) => create({ nickname: `User${i}`, role: 'learner', consent: true }, { headers: { 'x-forwarded-for': '8.8.8.8' } })));
  expect(responses.filter(r => r.status === 201)).toHaveLength(2);
  expect(responses.filter(r => r.status === 429)).toHaveLength(3);
});
