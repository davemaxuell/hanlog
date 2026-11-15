import { afterEach, expect, it, vi } from 'vitest';
import { PATCH as editProfile, DELETE as deleteProfile } from '@/app/api/session/route';
import { PUT as save, DELETE as unsave } from '@/app/api/progress/saved/[id]/route';
import { getDb } from '@/lib/db';
import { getMediaStore } from '@/lib/media';
import { revokeSessions } from '@/lib/repo/accounts';
import { getUser } from '@/lib/repo/users';
import { setSavedMission } from '@/lib/repo/progress';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, useMemoryMedia } from './_helpers';

useTestDb();
useMemoryMedia();
afterEach(() => vi.restoreAllMocks());

// Finish logout after the request reads its valid identity, but before that
// identity reaches the route. This models an in-flight request at revocation.
async function revokeAfterIdentityRead(userId: string) {
  const db = await getDb();
  const query = db.query.bind(db);
  let revoked = false;
  vi.spyOn(db, 'query').mockImplementation(async (sql, params) => {
    const result = await query(sql, params);
    if (!revoked && sql.startsWith('select id, nickname, role, created_at, session_version from hanlog.users')) {
      revoked = true;
      await revokeSessions(userId, 0);
    }
    return result;
  });
}

it('refuses profile edits authenticated before a completed sign-out', async () => {
  const { user, cookie } = await createTestUser();
  await revokeAfterIdentityRead(user.id);
  const response = await call(editProfile, makeRequest('PATCH', '/api/session', { cookie, json: { nickname: 'Changed' } }));
  expect(response.status).toBe(401);
  expect((await getUser(user.id))?.nickname).toBe(user.nickname);
});

it('refuses profile deletion authenticated before sign-out, before removing recordings', async () => {
  const { user, cookie } = await createTestUser();
  const remove = vi.spyOn(getMediaStore(), 'remove');
  await revokeAfterIdentityRead(user.id);
  const response = await call(deleteProfile, makeRequest('DELETE', '/api/session', { cookie }));
  expect(response.status).toBe(401);
  expect(await getUser(user.id)).toEqual(user);
  expect(remove).not.toHaveBeenCalled();
});

it.each([true, false])('refuses a saved-expression change (%s) authenticated before sign-out', async saved => {
  const { user, cookie } = await createTestUser();
  const missionId = 'cafe-iced-americano';
  await setSavedMission(user.id, missionId, !saved);
  await revokeAfterIdentityRead(user.id);
  const response = await call(saved ? save : unsave, makeRequest(saved ? 'PUT' : 'DELETE', `/api/progress/saved/${missionId}`, { cookie }), { id: missionId });
  expect(response.status).toBe(401);
  const rows = await (await getDb()).query('select mission_id from hanlog.saved_missions where user_id = $1', [user.id]);
  expect(rows).toHaveLength(saved ? 0 : 1);
});
