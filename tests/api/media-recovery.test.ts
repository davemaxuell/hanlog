import { afterEach, expect, it } from 'vitest';
import { getDb } from '@/lib/db';
import { createMemoryMediaStore, setMediaStoreForTests } from '@/lib/media';
import { cleanupExpiredMedia } from '@/lib/media/cleanup';
import { POST as createChallenge } from '@/app/api/challenges/route';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, mediaFile, postAnswer, postChallenge, webmBytes } from './_helpers';

useTestDb();
afterEach(() => setMediaStoreForTests(null));
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
