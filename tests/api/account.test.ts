import { afterEach, expect, it, vi } from 'vitest';
import { DELETE, GET } from '@/app/api/session/route';
import { getDb } from '@/lib/db';
import { getMediaStore } from '@/lib/media';
import { getUser } from '@/lib/repo/users';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, useMemoryMedia, webmBytes } from './_helpers';
useTestDb();
const media = useMemoryMedia();
afterEach(() => vi.restoreAllMocks());

async function addRecording(authorId: string, responderId: string, code: string) {
  const db = await getDb();
  const [{ id: challengeId }] = await db.query<{ id: string }>("insert into hanlog.challenges (code, author_id, korean, meaning_en) values ($1, $2, '안녕하세요', 'Hello') returning id", [code, authorId]);
  const reference = `references/${challengeId}.webm`;
  await db.query('update hanlog.challenges set reference_path=$2, reference_mime=$3 where id=$1', [challengeId, reference, 'audio/webm']);
  const [{ id: responseId }] = await db.query<{ id: string }>("insert into hanlog.challenge_responses (challenge_id, responder_id, media_kind, media_mime, duration_ms) values ($1,$2,'audio','audio/webm',1000) returning id", [challengeId, responderId]);
  const answer = `responses/${responseId}.webm`;
  await db.query('update hanlog.challenge_responses set media_path=$2 where id=$1', [responseId, answer]);
  await getMediaStore().put(reference, webmBytes(), 'audio/webm');
  await getMediaStore().put(answer, webmBytes(), 'audio/webm');
  return { reference, answer };
}
it('deletes owned rows and recordings while preserving other profiles and spend counters', async () => {
  const author = await createTestUser('korean');
  const learner = await createTestUser();
  const otherAuthor = await createTestUser('korean');
  const otherLearner = await createTestUser();
  await addRecording(author.user.id, learner.user.id, 'ABC234');
  const kept = await addRecording(otherAuthor.user.id, otherLearner.user.id, 'ABC235');
  const db = await getDb();
  await db.query('insert into hanlog.scoring_calls (user_id,ip_hash) values ($1,$2)', [author.user.id, 'budget']);
  const res = await call(DELETE, makeRequest('DELETE', '/api/session', { cookie: author.cookie }));
  expect(res.status).toBe(204);
  expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  expect(await getUser(author.user.id)).toBeNull();
  expect(await getUser(learner.user.id)).not.toBeNull();
  expect(media.paths()).toEqual([kept.reference, kept.answer].sort());
  expect((await (await call(GET, makeRequest('GET', '/api/session', { cookie: author.cookie }))).json()).user).toBeNull();
  expect((await db.query<{ n: number }>('select count(*)::int as n from hanlog.scoring_calls'))[0].n).toBe(1);
});
it('requires a session', async () => { expect((await call(DELETE, makeRequest('DELETE', '/api/session'))).status).toBe(401); });
it('still deletes identity when storage fails and logs only orphan paths', async () => {
  const author = await createTestUser('korean');
  const learner = await createTestUser();
  const paths = await addRecording(author.user.id, learner.user.id, 'ABC236');
  vi.spyOn(getMediaStore(), 'remove').mockRejectedValueOnce(new Error('secret-driver-details'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  expect((await call(DELETE, makeRequest('DELETE', '/api/session', { cookie: author.cookie }))).status).toBe(204);
  expect(await getUser(author.user.id)).toBeNull();
  expect(JSON.stringify(log.mock.calls)).toContain(paths.reference);
  expect(JSON.stringify(log.mock.calls)).not.toContain('secret-driver-details');
});
