import { afterEach, expect, it, vi } from 'vitest';
import { GET, PATCH, POST } from '@/app/api/session/route';
import { getDb } from '@/lib/db';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, cookieFrom } from './_helpers';

useTestDb();
afterEach(() => vi.unstubAllEnvs());
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
