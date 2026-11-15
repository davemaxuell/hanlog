import { expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { getConfig } from '@/lib/config';
import { SESSION_COOKIE, clearSessionCookieHeader, getSessionUser, requireUser, sessionCookieHeader, signSession, verifySession } from '@/lib/session';
import { deleteUserCascade } from '@/lib/repo/users';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';

useTestDb();

it('treats expired and wrong-algorithm tokens as no session', async () => {
  const signingKey = new TextEncoder().encode(getConfig().sessionSecret);
  const expired = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11').setIssuedAt(1).setExpirationTime(2).sign(signingKey);
  const otherAlg = await new SignJWT({}).setProtectedHeader({ alg: 'HS384' }).setSubject('3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11').setIssuedAt().setExpirationTime('90d').sign(signingKey);
  expect(await verifySession(expired)).toBeNull();
  expect(await verifySession(otherAlg)).toBeNull();
});

it('signs and verifies', async () => {
  const id = '3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11';
  const token = await signSession(id);
  expect(await verifySession(token)).toBe(id);
  expect(await verifySession(token.slice(0, -2) + 'xx')).toBeNull();
  expect(await verifySession('garbage')).toBeNull();
  expect(await verifySession('')).toBeNull();
});
it('resolves the user from the cookie among other cookies', async () => {
  const { user, cookie } = await createTestUser('learner', '아이샤');
  const found = await getSessionUser(makeRequest('GET', '/api/session', { cookie: `theme=dark; ${cookie}; x=1` }));
  expect(found).toEqual(user);
});
it('treats missing, forged, and orphaned sessions as no user', async () => {
  expect(await getSessionUser(makeRequest('GET', '/api/session'))).toBeNull();
  expect(await getSessionUser(makeRequest('GET', '/api/session', { cookie: `${SESSION_COOKIE}=forged` }))).toBeNull();
  const { user, cookie } = await createTestUser();
  await deleteUserCascade(user.id);
  expect(await getSessionUser(makeRequest('GET', '/api/session', { cookie }))).toBeNull();
  await expect(requireUser(makeRequest('GET', '/api/points'))).rejects.toMatchObject({ code: 'unauthenticated' });
});
it('builds cookie headers', () => {
  const set = sessionCookieHeader('tok');
  expect(set).toContain('hl_session=tok');
  for (const part of ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=7776000']) expect(set).toContain(part);
  expect(set).not.toContain('Secure');           // not production in tests
  expect(clearSessionCookieHeader()).toContain('Max-Age=0');
});
