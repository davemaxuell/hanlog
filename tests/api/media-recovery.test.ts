import { afterEach, expect, it } from 'vitest';
import { getDb, setDbForTests, type Db } from '@/lib/db';
import { createMemoryMediaStore, setMediaStoreForTests } from '@/lib/media';
import { cleanupExpiredMedia } from '@/lib/media/cleanup';
import { POST as createChallenge } from '@/app/api/challenges/route';
import { DELETE as deleteSession } from '@/app/api/session/route';
import { getUser } from '@/lib/repo/users';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, mediaFile, postAnswer, postChallenge, webmBytes } from './_helpers';

useTestDb();
afterEach(() => setMediaStoreForTests(null));
function loseCommitReplyOnce(db: Db, matches: (sql: string) => boolean): Db {
  let failed = false;
  return { query: db.query.bind(db), tx: async fn => {
    let matching = false;
    const result = await db.tx(async tx => fn({
      query: async (sql, params) => { matching ||= matches(sql); return tx.query(sql, params); },
      tx: nested => tx.tx(nested),
    }));
    if (matching && !failed) { failed = true; throw new Error('connection lost after COMMIT'); }
    return result;
  } };
}
it('keeps committed response bytes after the COMMIT reply is lost', async () => {
  const author = await createTestUser('korean'); const learner = await createTestUser();
  const store = createMemoryMediaStore(); setMediaStoreForTests(store);
  const challenge = await postChallenge(author.cookie); const db = await getDb();
  setDbForTests(loseCommitReplyOnce(db, sql => sql.startsWith('insert into hanlog.challenge_responses')));
  expect((await postAnswer(learner.cookie, challenge.id)).status).toBe(503);
  const [row] = await db.query<{ media_path: string }>('select media_path from hanlog.challenge_responses where challenge_id = $1', [challenge.id]);
  expect(await store.get(row.media_path)).toEqual(webmBytes());
});
it('keeps committed reference metadata and bytes after the COMMIT reply is lost', async () => {
  const author = await createTestUser('korean'); const db = await getDb();
  const store = createMemoryMediaStore(); setMediaStoreForTests(store);
  setDbForTests(loseCommitReplyOnce(db, sql => sql.startsWith('update hanlog.challenges set reference_path')));
  const form = new FormData();
  form.set('korean', '안녕하세요'); form.set('meaningEn', 'Hello');
  form.set('media', mediaFile(webmBytes(), 'audio/webm')); form.set('durationMs', '3000');
  expect((await call(createChallenge, makeRequest('POST', '/api/challenges', { cookie: author.cookie, form }))).status).toBe(503);
  const rows = await db.query<{ reference_path: string }>('select reference_path from hanlog.challenges where author_id = $1', [author.user.id]);
  expect(rows).toHaveLength(1);
  expect(await store.get(rows[0].reference_path)).toEqual(webmBytes());
});
it('retries files left by both an upload failure and a compensation failure', async () => {
  const author = await createTestUser('korean');
  const learner = await createTestUser();
  const store = createMemoryMediaStore();
  setMediaStoreForTests(store);
  const challenge = await postChallenge(author.cookie);
  setMediaStoreForTests({ ...store,
    put: async (path, bytes, mime) => { await store.put(path, bytes, mime); throw new Error('upload response lost'); },
    remove: async () => { throw new Error('storage unavailable'); },
  });
  const form = new FormData();
  form.set('korean', '안녕하세요'); form.set('meaningEn', 'Hello');
  form.set('media', mediaFile(webmBytes(), 'audio/webm')); form.set('durationMs', '3000');
  expect((await call(createChallenge, makeRequest('POST', '/api/challenges', { cookie: author.cookie, form }))).status).toBe(503);
  expect((await postAnswer(learner.cookie, challenge.id)).status).toBe(503);
  expect(store.paths()).toHaveLength(2);
  const db = await getDb();
  expect((await db.query<{ n: number }>('select count(*)::int as n from hanlog.pending_media_deletions'))[0].n).toBe(2);
  setMediaStoreForTests(store);
  expect(await cleanupExpiredMedia()).toBe(0); // Grace period protects in-flight requests.
  await db.query("update hanlog.pending_media_deletions set created_at = now() - interval '2 hours'");
  expect(await cleanupExpiredMedia()).toBe(2);
  expect(store.paths()).toEqual([]);
});
it('never removes a queued path that is still referenced by an active response', async () => {
  const author = await createTestUser('korean'); const learner = await createTestUser();
  const store = createMemoryMediaStore(); setMediaStoreForTests(store);
  const challenge = await postChallenge(author.cookie);
  expect((await postAnswer(learner.cookie, challenge.id)).status).toBe(201);
  const path = store.paths()[0]; const db = await getDb();
  await db.query("insert into hanlog.pending_media_deletions(path, created_at) values ($1, now() - interval '2 hours')", [path]);
  expect(await cleanupExpiredMedia()).toBe(0);
  expect(store.paths()).toEqual([path]);
});
it('keeps a replacement usable when removing the older file fails, then retries cleanup', async () => {
  const author = await createTestUser('korean'); const learner = await createTestUser();
  const store = createMemoryMediaStore(); setMediaStoreForTests(store);
  const challenge = await postChallenge(author.cookie);
  const first = (await (await postAnswer(learner.cookie, challenge.id)).json()).response;
  const oldPath = store.paths()[0];
  setMediaStoreForTests({ ...store, remove: async () => { throw new Error('temporary removal failure'); } });
  const replacement = await postAnswer(learner.cookie, challenge.id);
  expect(replacement.status).toBe(201);
  expect((await replacement.json()).response.id).toBe(first.id);
  const db = await getDb();
  const [row] = await db.query<{ media_path: string }>('select media_path from hanlog.challenge_responses where id = $1', [first.id]);
  expect(row.media_path).not.toBe(oldPath);
  expect(store.paths()).toHaveLength(2);
  setMediaStoreForTests(store);
  await db.query("update hanlog.pending_media_deletions set created_at = now() - interval '2 hours'");
  expect(await cleanupExpiredMedia()).toBe(1);
  expect(store.paths()).toEqual([row.media_path]);
});
it.each(['learner', 'author'] as const)('deletes queued old recordings with the %s profile, retrying storage failures', async role => {
  const author = await createTestUser('korean'); const learner = await createTestUser();
  const store = createMemoryMediaStore(); setMediaStoreForTests(store);
  const challenge = await postChallenge(author.cookie);
  await postAnswer(learner.cookie, challenge.id);
  const oldPath = store.paths()[0];
  setMediaStoreForTests({ ...store, remove: async paths => { if (paths.includes(oldPath)) throw new Error('old recording removal unavailable'); await store.remove(paths); } });
  expect((await postAnswer(learner.cookie, challenge.id)).status).toBe(201);
  const profile = role === 'learner' ? learner : author;
  expect((await call(deleteSession, makeRequest('DELETE', '/api/session', { cookie: profile.cookie }))).status).toBe(503);
  expect(await getUser(profile.user.id)).not.toBeNull();
  setMediaStoreForTests(store);
  expect((await call(deleteSession, makeRequest('DELETE', '/api/session', { cookie: profile.cookie }))).status).toBe(204);
  expect(store.paths()).toEqual([]);
  expect((await (await getDb()).query<{ n: number }>('select count(*)::int as n from hanlog.pending_media_deletions'))[0].n).toBe(0);
});
it('includes an abandoned reference even after its incomplete challenge row was removed', async () => {
  const author = await createTestUser('korean');
  const store = createMemoryMediaStore();
  setMediaStoreForTests({ ...store,
    put: async (path, bytes, mime) => { await store.put(path, bytes, mime); throw new Error('write acknowledgement lost'); },
    remove: async () => { throw new Error('storage unavailable'); },
  });
  const form = new FormData(); form.set('korean', '안녕하세요'); form.set('meaningEn', 'Hello');
  form.set('media', mediaFile(webmBytes(), 'audio/webm')); form.set('durationMs', '3000');
  expect((await call(createChallenge, makeRequest('POST', '/api/challenges', { cookie: author.cookie, form }))).status).toBe(503);
  const db = await getDb();
  expect((await db.query('select id from hanlog.challenges where author_id = $1', [author.user.id]))).toHaveLength(0);
  expect((await call(deleteSession, makeRequest('DELETE', '/api/session', { cookie: author.cookie }))).status).toBe(503);
  expect(await getUser(author.user.id)).not.toBeNull();
  setMediaStoreForTests(store);
  expect((await call(deleteSession, makeRequest('DELETE', '/api/session', { cookie: author.cookie }))).status).toBe(204);
  expect(store.paths()).toEqual([]);
});
