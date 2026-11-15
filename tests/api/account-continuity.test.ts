import { expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { GET as status } from '@/app/api/account/route';
import { POST as generate } from '@/app/api/account/recovery-key/route';
import { POST as restore } from '@/app/api/account/restore/route';
import { POST as logout } from '@/app/api/account/logout/route';
import { GET as exportData } from '@/app/api/account/export/route';
import { getDb } from '@/lib/db';
import { getConfig } from '@/lib/config';
import { getSessionUser } from '@/lib/session';
import { deleteUserCascade } from '@/lib/repo/users';
import { RecoveryResultSchema } from '@/lib/account-contracts';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, cookieFrom } from './_helpers';

useTestDb();
const keyFor = (cookie: string) => call(generate, makeRequest('POST', '/api/account/recovery-key', { cookie }));
const recover = (recoveryKey: string, address = '203.0.113.5', requestId = randomUUID()) => call(restore, makeRequest('POST', '/api/account/restore', { json: { recoveryKey, requestId }, headers: { 'x-forwarded-for': address } }));

it('keeps existing unversioned cookies working until a restore revokes them', async () => {
  const { user } = await createTestUser();
  const legacy = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime('90d').sign(new TextEncoder().encode(getConfig().sessionSecret));
  const cookie = `hl_session=${legacy}`;
  expect(await getSessionUser(makeRequest('GET', '/api/session', { cookie }))).toEqual(user);
  const result = await keyFor(cookie);
  expect(result.status).toBe(200);
  const body = RecoveryResultSchema.parse(await result.json());
  expect(body.user).toEqual(user);
  expect(await getSessionUser(makeRequest('GET', '/api/session', { cookie }))).toEqual(user);
  expect(await getSessionUser(makeRequest('GET', '/api/session', { cookie: cookieFrom(result) }))).toEqual(user);
  const [stored] = await (await getDb()).query<{ recovery_key_hash: string; session_version: number }>('select recovery_key_hash, session_version from hanlog.users where id = $1', [user.id]);
  expect(stored.recovery_key_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(stored.recovery_key_hash).not.toContain(body.recoveryKey);
  expect(stored.session_version).toBe(0);
  await recover(body.recoveryKey);
  expect(await getSessionUser(makeRequest('GET', '/api/session', { cookie }))).toBeNull();
});

it('restores cross-device, rotates the key atomically, and refuses replay', async () => {
  const original = await createTestUser();
  const issued = await keyFor(original.cookie);
  const { recoveryKey } = await issued.json();
  const attempts = await Promise.all([recover(recoveryKey), recover(recoveryKey)]);
  expect(attempts.map(r => r.status).sort()).toEqual([200, 401]);
  const success = attempts.find(r => r.status === 200)!;
  const restored = RecoveryResultSchema.parse(await success.json());
  expect(restored.user.id).toBe(original.user.id);
  expect(restored.recoveryKey).not.toBe(recoveryKey);
  expect(await getSessionUser(makeRequest('GET', '/api/session', { cookie: cookieFrom(issued) }))).toBeNull();
  expect(await getSessionUser(makeRequest('GET', '/api/session', { cookie: cookieFrom(success) }))).toEqual(original.user);
  expect((await recover(recoveryKey)).status).toBe(401);
  expect((await recover(restored.recoveryKey)).status).toBe(200);
});

it('throttles invalid recovery attempts durably and resets an expired window', async () => {
  const key = `hlk_${'a'.repeat(43)}`;
  for (let i = 0; i < 10; i++) expect((await recover(key)).status).toBe(401);
  expect((await recover(key)).status).toBe(429);
  expect((await recover(key, '203.0.113.6')).status).toBe(401);
  await (await getDb()).query("update hanlog.recovery_attempt_limits set window_start = now() - interval '16 minutes'");
  expect((await recover(key)).status).toBe(401);
});
it('recovers a lost tenth response without charging an identical valid retry', async () => {
  const { user, cookie } = await createTestUser();
  const key = (await (await keyFor(cookie)).json()).recoveryKey;
  const address = '203.0.113.12'; const requestId = randomUUID();
  for (let i = 0; i < 9; i++) expect((await recover(`hlk_${'z'.repeat(43)}`, address)).status).toBe(401);
  const success = await recover(key, address, requestId);
  expect(success.status).toBe(200);
  const body = await success.json(); const db = await getDb();
  const proof = () => db.query('select session_version,recovery_key_hash,recovery_retry_expires_at,recovery_retry_version from hanlog.users where id = $1', [user.id]);
  const before = await proof();
  const retry = await recover(key, address, requestId);
  expect(retry.status).toBe(200);
  expect(await retry.json()).toEqual(body);
  expect(await proof()).toEqual(before);
  expect((await db.query<{ attempts: number }>('select attempts from hanlog.recovery_attempt_limits'))[0].attempts).toBe(10);
  expect((await recover(key, address, randomUUID())).status).toBe(429);
  expect((await recover(key, address, requestId)).status).toBe(200);
  expect((await call(logout, makeRequest('POST', '/api/account/logout', { cookie: cookieFrom(retry) }))).status).toBe(204);
  expect((await recover(key, address, requestId)).status).not.toBe(200);
});
it('keeps simultaneous recovery throttling atomic and lets a still-signed-in user retry lost generation', async () => {
  const requests = await Promise.all(Array.from({ length: 12 }, () => recover(`hlk_${'b'.repeat(43)}`, '203.0.113.8')));
  expect(requests.filter(r => r.status === 401)).toHaveLength(10);
  expect(requests.filter(r => r.status === 429)).toHaveLength(2);
  const { cookie } = await createTestUser();
  const first = await keyFor(cookie); const firstKey = (await first.json()).recoveryKey;
  const second = await keyFor(cookie); const secondKey = (await second.json()).recoveryKey;
  expect(second.status).toBe(200);
  expect(secondKey).not.toBe(firstKey);
  expect((await recover(firstKey)).status).toBe(401);
  expect((await recover(secondKey)).status).toBe(200);
});
it('reissues the exact restore result for a lost response or simultaneous identical request', async () => {
  const { cookie } = await createTestUser();
  const issued = await keyFor(cookie); const oldKey = (await issued.json()).recoveryKey;
  const requestId = randomUUID();
  const responses = await Promise.all([recover(oldKey, '203.0.113.9', requestId), recover(oldKey, '203.0.113.9', requestId)]);
  expect(responses.map(response => response.status)).toEqual([200, 200]);
  const first = await responses[0].json();
  expect(await responses[1].json()).toEqual(first);
  const retry = await recover(oldKey, '203.0.113.9', requestId);
  expect(await retry.json()).toEqual(first);
  expect(await getSessionUser(makeRequest('GET', '/api/session', { cookie: cookieFrom(responses[0]) }))).not.toBeNull();
  const [row] = await (await getDb()).query<{ session_version: number; recovery_previous_hash: string; recovery_request_hash: string }>('select session_version,recovery_previous_hash,recovery_request_hash from hanlog.users where id = $1', [first.user.id]);
  expect(row.session_version).toBe(1);
  expect(row.recovery_previous_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(row.recovery_request_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(row)).not.toContain(oldKey);
  expect(JSON.stringify(row)).not.toContain(requestId);
  expect((await recover(oldKey, '203.0.113.9', randomUUID())).status).toBe(401);
});
it('expires restore retry proofs and cannot use one to undo sign-out', async () => {
  const { cookie } = await createTestUser();
  const issued = await keyFor(cookie); const oldKey = (await issued.json()).recoveryKey; const requestId = randomUUID();
  const restored = await recover(oldKey, '203.0.113.10', requestId); const body = await restored.json();
  await (await getDb()).query("update hanlog.users set recovery_retry_expires_at = now() - interval '1 second' where id = $1", [body.user.id]);
  expect((await recover(oldKey, '203.0.113.10', requestId)).status).toBe(401);
  const nextId = randomUUID(); const next = await recover(body.recoveryKey, '203.0.113.10', nextId);
  expect(next.status).toBe(200);
  await call(logout, makeRequest('POST', '/api/account/logout', { cookie: cookieFrom(next) }));
  expect((await recover(body.recoveryKey, '203.0.113.10', nextId)).status).toBe(401);
});
it('cannot replay an older restore after another restore or authenticated key replacement', async () => {
  const { cookie } = await createTestUser();
  const oldKey = (await (await keyFor(cookie)).json()).recoveryKey; const firstNonce = randomUUID();
  const first = await recover(oldKey, '203.0.113.11', firstNonce); const firstBody = await first.json();
  const secondNonce = randomUUID(); const second = await recover(firstBody.recoveryKey, '203.0.113.11', secondNonce);
  expect(second.status).toBe(200);
  expect((await recover(oldKey, '203.0.113.11', firstNonce)).status).toBe(401);
  expect((await keyFor(cookieFrom(second))).status).toBe(200);
  expect((await recover(firstBody.recoveryKey, '203.0.113.11', secondNonce)).status).toBe(401);
});
it('refuses unsupported token version claims', async () => {
  const { user } = await createTestUser();
  for (const v of ['0', -1, 0.5, 1, null, false]) {
    const token = await new SignJWT({ v }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime('90d').sign(new TextEncoder().encode(getConfig().sessionSecret));
    expect(await getSessionUser(makeRequest('GET', '/api/session', { cookie: `hl_session=${token}` }))).toBeNull();
  }
});

it('requires authentication and same origin, while status never exposes a credential', async () => {
  expect((await keyFor('')).status).toBe(401);
  expect((await call(status, makeRequest('GET', '/api/account'))).status).toBe(401);
  expect((await recover('short')).status).toBe(400);
  const { cookie } = await createTestUser();
  expect((await call(generate, makeRequest('POST', '/api/account/recovery-key', { cookie, headers: { origin: 'https://untrusted.example' } }))).status).toBe(403);
  const issued = await keyFor(cookie);
  const body = await (await call(status, makeRequest('GET', '/api/account', { cookie: cookieFrom(issued) }))).json();
  expect(body).toEqual({ recoveryEnabled: true, recoveryUpdatedAt: expect.any(String) });
});

it('signs out every session without deleting the profile or its recovery key', async () => {
  const { user, cookie } = await createTestUser();
  const issued = await keyFor(cookie);
  const { recoveryKey } = await issued.json();
  const res = await call(logout, makeRequest('POST', '/api/account/logout', { cookie: cookieFrom(issued) }));
  expect(res.status).toBe(204);
  expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  expect(await getSessionUser(makeRequest('GET', '/api/session', { cookie: cookieFrom(issued) }))).toBeNull();
  expect((await recover(recoveryKey)).status).toBe(200);
  expect(await (await getDb()).query('select id from hanlog.users where id = $1', [user.id])).toHaveLength(1);
});

it('exports owned data without secrets or private storage locations and deletes recovery with the profile', async () => {
  const owner = await createTestUser('learner', 'Owner');
  const other = await createTestUser('learner', 'Unrelated');
  const issued = await keyFor(owner.cookie);
  const { recoveryKey } = await issued.json();
  await (await getDb()).query('insert into hanlog.saved_missions (user_id, mission_id) values ($1,$2),($3,$4)', [owner.user.id, 'cafe-iced-americano', other.user.id, 'private-other-expression']);
  const res = await call(exportData, makeRequest('GET', '/api/account/export', { cookie: cookieFrom(issued) }));
  expect(res.status).toBe(200);
  expect(res.headers.get('content-disposition')).toContain('attachment;');
  const body = await res.json();
  expect(body.profile).toEqual(owner.user);
  expect(body.savedMissions.map((entry: { missionId: string }) => entry.missionId)).toEqual(['cafe-iced-americano']);
  const serialized = JSON.stringify(body);
  for (const privateText of [recoveryKey, 'recovery_key_hash', 'session_version', 'ip_hash', 'media_path', 'reference_path', 'private-other-expression', 'Unrelated']) expect(serialized).not.toContain(privateText);
  await deleteUserCascade(owner.user.id);
  expect((await recover(recoveryKey)).status).toBe(401);
});
it('exports every owned record through bounded pages without truncation', async () => {
  const owner = await createTestUser(); const other = await createTestUser(); const db = await getDb();
  await db.query("insert into hanlog.point_events (user_id,delta,reason,ref_id,label) select $1,1,'mission',n::text,'Owned event' from generate_series(1,260) n", [owner.user.id]);
  await db.query("insert into hanlog.point_events (user_id,delta,reason,ref_id,label) values ($1,1,'mission','other','Private other event')", [other.user.id]);
  const res = await call(exportData, makeRequest('GET', '/api/account/export', { cookie: owner.cookie }));
  const body = await res.json();
  expect(body.pointEvents).toHaveLength(260);
  expect(new Set(body.pointEvents.map((event: { id: string }) => event.id)).size).toBe(260);
  expect(JSON.stringify(body)).not.toContain('Private other event');
});
it('includes the profile own reports without another reporter data', async () => {
  const owner = await createTestUser(); const other = await createTestUser(); const db = await getDb();
  const [challenge] = await db.query<{ id: string }>('select id from hanlog.challenges where is_sample = true limit 1');
  await db.query("insert into hanlog.community_reports (reporter_id,challenge_id,reason) values ($1,$3,'privacy'),($2,$3,'spam')", [owner.user.id, other.user.id, challenge.id]);
  const body = await (await call(exportData, makeRequest('GET', '/api/account/export', { cookie: owner.cookie }))).json();
  expect(body.reports).toHaveLength(1);
  expect(body.reports[0]).toMatchObject({ challengeId: challenge.id, reason: 'privacy', status: 'open' });
  expect(body.reports[0]).not.toHaveProperty('reporter_id');
});
