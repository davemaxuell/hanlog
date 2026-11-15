import { expect, it } from 'vitest';
import { GET as list, POST as create } from '@/app/api/challenges/route';
import { GET as detail } from '@/app/api/challenges/[id]/route';
import { DELETE as deleteSession } from '@/app/api/session/route';
import { SHARE_CODE_ALPHABET } from '@/lib/contracts';
import { getSampleChallenges } from '@/lib/content';
import { getDb, setDbForTests } from '@/lib/db';
import { createMemoryMediaStore, setMediaStoreForTests } from '@/lib/media';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, mediaFile, mp4Bytes, useMemoryMedia, webmBytes } from './_helpers';

useTestDb();
const media = useMemoryMedia();
const fields = { korean: '이거 완전 꿀잼이야.', meaningEn: '꿀잼 means really fun.', situationEn: 'After a great movie.' };
const post = (cookie: string | undefined, over: Record<string, string | File> = {}) => {
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...fields, ...over })) form.set(k, v);
  return call(create, makeRequest('POST', '/api/challenges', { cookie, form }));
};
const get = async (cookie: string, scope: string) => (await call(list, makeRequest('GET', `/api/challenges?scope=${scope}`, { cookie }))).json();

it('lets a Korean speaker post a challenge with a share code', async () => {
  const { user, cookie } = await createTestUser('korean', 'Minji');
  const res = await post(cookie);
  expect(res.status).toBe(201);
  const { challenge } = await res.json();
  expect(challenge).toMatchObject({ ...fields, author: { id: user.id, nickname: 'Minji' }, hasReference: false, isSample: false, viewer: { responded: false, pendingToRate: 0 } });
  expect(challenge.code).toHaveLength(6);
  expect([...challenge.code].every((ch: string) => SHARE_CODE_ALPHABET.includes(ch))).toBe(true);
});
it('stores an audio reference clip', async () => {
  const { cookie } = await createTestUser('korean');
  const { challenge } = await (await post(cookie, { media: mediaFile(webmBytes(), 'audio/webm'), durationMs: '2500' })).json();
  expect(challenge.hasReference).toBe(true);
  expect(media.paths()).toEqual([`references/${challenge.id}.webm`]);
  const video = await post(cookie, { media: mediaFile(mp4Bytes(), 'video/mp4'), durationMs: '2500' });
  expect([video.status, (await video.json()).error.code]).toEqual([415, 'media_invalid']);
});
it('refuses learners, bad fields, links, and the eleventh of the day', async () => {
  const code = async (res: Response) => [res.status, (await res.json()).error.code];
  expect(await code(await post(undefined))).toEqual([401, 'unauthenticated']);
  expect(await code(await post((await createTestUser('learner')).cookie))).toEqual([403, 'forbidden']);
  const { user, cookie } = await createTestUser('korean');
  expect(await code(await post(cookie, { korean: 'kkuljaem' }))).toEqual([400, 'invalid_input']);
  expect(await code(await post(cookie, { meaningEn: '' }))).toEqual([400, 'invalid_input']);
  expect(await code(await post(cookie, { situationEn: 'see https://x.example' }))).toEqual([422, 'content_rejected']);
  const db = await getDb();
  for (let i = 0; i < 10; i++)
    await db.query(`insert into hanlog.challenges (code, author_id, korean, meaning_en) values ($1, $2, '가', 'm')`, [`ZZZZ${'23456789AB'[i]}Z`, user.id]);
  expect(await code(await post(cookie))).toEqual([429, 'daily_limit']);
});
it('lists by scope', async () => {
  const korean = await createTestUser('korean', 'Minji');
  const learner = await createTestUser('learner', 'Aisha');
  const { challenge } = await (await post(korean.cookie)).json();
  const open = (await get(learner.cookie, 'open')).challenges;
  expect(open[0].id).toBe(challenge.id);                                   // newest first
  expect(open).toHaveLength(1 + getSampleChallenges().length);
  expect((await get(korean.cookie, 'open')).challenges.map((c: { id: string }) => c.id)).not.toContain(challenge.id);
  expect((await get(korean.cookie, 'mine')).challenges.map((c: { id: string }) => c.id)).toEqual([challenge.id]);
  expect((await get(korean.cookie, 'to-rate')).challenges).toEqual([]);
  expect((await get(learner.cookie, 'answered')).challenges).toEqual([]);
  expect((await call(list, makeRequest('GET', '/api/challenges?scope=everything', { cookie: learner.cookie }))).status).toBe(400);
  expect((await call(list, makeRequest('GET', '/api/challenges?scope=open'))).status).toBe(401);
});
it('shows detail by id or by code in any case, with the viewer role', async () => {
  const korean = await createTestUser('korean');
  const other = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const { challenge } = await (await post(korean.cookie)).json();
  const view = async (cookie: string, key: string) => (await call(detail, makeRequest('GET', `/api/challenges/${key}`, { cookie }), { id: key })).json();
  expect(await view(korean.cookie, challenge.id)).toMatchObject({ viewerRole: 'author', myResponse: null, responses: [] });
  expect((await view(learner.cookie, challenge.code.toLowerCase())).challenge.id).toBe(challenge.id);
  expect((await view(learner.cookie, challenge.code)).viewerRole).toBe('visitor');
  expect((await view(other.cookie, challenge.id)).viewerRole).toBe('visitor');
  expect((await view(other.cookie, getSampleChallenges()[0].code)).viewerRole).toBe('rater');
  expect((await call(detail, makeRequest('GET', '/api/challenges/NOPE99', { cookie: learner.cookie }), { id: 'NOPE99' })).status).toBe(404);
});

it('keeps the daily challenge cap under concurrent creation', async () => {
  const { cookie } = await createTestUser('korean');
  const results = await Promise.all(Array.from({ length: 12 }, () => post(cookie)));
  expect(results.filter(result => result.status === 201)).toHaveLength(10);
  expect(results.filter(result => result.status === 429)).toHaveLength(2);
});
it('removes an incomplete challenge when reference storage fails', async () => {
  const { user, cookie } = await createTestUser('korean');
  setMediaStoreForTests({ ...createMemoryMediaStore(), put: async () => { throw new Error('storage offline'); } });
  expect((await post(cookie, { media: mediaFile(webmBytes(), 'audio/webm'), durationMs: '1000' })).status).toBe(503);
  expect((await (await getDb()).query<{ n: number }>('select count(*)::int as n from hanlog.challenges where author_id = $1', [user.id]))[0].n).toBe(0);
});
it('does not upload a reference if its owner deletes their profile after registration', async () => {
  const { user, cookie } = await createTestUser('korean');
  const store = createMemoryMediaStore();
  setMediaStoreForTests(store);
  const db = await getDb(); let deleted = false;
  setDbForTests({ query: db.query.bind(db), tx: async fn => {
    let registered = false;
    const result = await db.tx(tx => fn({ query: async (sql, params) => { registered ||= sql.startsWith('insert into hanlog.pending_media_deletions'); return tx.query(sql, params); }, tx: tx.tx.bind(tx) }));
    if (registered && !deleted) { deleted = true; expect((await call(deleteSession, makeRequest('DELETE', '/api/session', { cookie }))).status).toBe(204); }
    return result;
  } });
  expect((await post(cookie, { media: mediaFile(webmBytes(), 'audio/webm'), durationMs: '1000' })).status).toBe(503);
  expect(store.paths()).toEqual([]);
  expect((await (await getDb()).query<{ n: number }>('select count(*)::int as n from hanlog.challenges where author_id = $1', [user.id]))[0].n).toBe(0);
});
