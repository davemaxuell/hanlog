import { expect, it } from 'vitest';
import { GET as list, POST as create } from '@/app/api/challenges/route';
import { GET as detail } from '@/app/api/challenges/[id]/route';
import { POST as answer } from '@/app/api/challenges/[id]/responses/route';
import { PATCH as patchSession } from '@/app/api/session/route';
import { getSampleChallenges } from '@/lib/content';
import { getDb } from '@/lib/db';
import { createMemoryMediaStore, getMediaStore, setMediaStoreForTests } from '@/lib/media';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, mediaFile, mp4Bytes, useMemoryMedia, webmBytes } from './_helpers';

useTestDb();
const media = useMemoryMedia();
const newChallenge = async (cookie: string) => {
  const form = new FormData();
  form.set('korean', '이거 완전 꿀잼이야.'); form.set('meaningEn', 'Really fun.'); form.set('situationEn', '');
  return (await (await call(create, makeRequest('POST', '/api/challenges', { cookie, form }))).json()).challenge;
};
const send = (cookie: string | undefined, id: string, file = mediaFile(webmBytes(), 'audio/webm'), kind = 'audio') => {
  const form = new FormData();
  form.set('media', file); form.set('kind', kind); form.set('durationMs', '3000');
  return call(answer, makeRequest('POST', `/api/challenges/${id}/responses`, { cookie, form }), { id });
};
const view = async (cookie: string, id: string) => (await call(detail, makeRequest('GET', `/api/challenges/${id}`, { cookie }), { id })).json();
const scope = async (cookie: string, s: string) => (await (await call(list, makeRequest('GET', `/api/challenges?scope=${s}`, { cookie }))).json()).challenges;

it('accepts an answer and shows it to both sides', async () => {
  const korean = await createTestUser('korean', 'Minji');
  const learner = await createTestUser('learner', 'Aisha');
  const challenge = await newChallenge(korean.cookie);
  const res = await send(learner.cookie, challenge.id);
  expect(res.status).toBe(201);
  const { response } = await res.json();
  expect(response).toMatchObject({ challengeId: challenge.id, responder: { id: learner.user.id, nickname: 'Aisha' }, mediaKind: 'audio', mediaAvailable: true, durationMs: 3001, status: 'pending', rating: null, feedback: null });
  expect(media.paths()).toEqual([`responses/${response.id}.webm`]);
  expect(await view(learner.cookie, challenge.id)).toMatchObject({ viewerRole: 'responder', myResponse: { id: response.id }, responses: [] });
  expect((await view(korean.cookie, challenge.id)).responses.map((r: { id: string }) => r.id)).toEqual([response.id]);
  expect((await scope(learner.cookie, 'answered')).map((c: { id: string }) => c.id)).toEqual([challenge.id]);
  expect((await scope(learner.cookie, 'open')).find((c: { id: string }) => c.id === challenge.id).viewer.responded).toBe(true);
  expect(await scope(korean.cookie, 'to-rate')).toMatchObject([{ id: challenge.id, viewer: { pendingToRate: 1 } }]);
});
it('replaces a pending answer and removes the old file', async () => {
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const challenge = await newChallenge(korean.cookie);
  const first = (await (await send(learner.cookie, challenge.id)).json()).response;
  const second = (await (await send(learner.cookie, challenge.id, mediaFile(mp4Bytes(), 'video/mp4'), 'video')).json()).response;
  expect(second).toMatchObject({ id: first.id, mediaKind: 'video' });
  expect(media.paths()).toHaveLength(1);
  expect(media.paths()[0]).toMatch(/^responses\/[a-f0-9-]+\.mp4$/);
  expect(media.paths()[0]).not.toBe(`responses/${first.id}.mp4`);
});
it('lets any Korean speaker see answers to a sample challenge', async () => {
  const learner = await createTestUser('learner');
  const korean = await createTestUser('korean');
  const sample = (await view(learner.cookie, getSampleChallenges()[0].code)).challenge;
  const { response } = await (await send(learner.cookie, sample.id)).json();
  expect(await view(korean.cookie, sample.id)).toMatchObject({ viewerRole: 'rater', responses: [{ id: response.id }] });
  expect((await scope(korean.cookie, 'to-rate')).map((c: { id: string }) => c.id)).toEqual([sample.id]);
});
it('refuses the wrong people and the wrong files', async () => {
  const code = async (res: Response) => [res.status, (await res.json()).error.code];
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const challenge = await newChallenge(korean.cookie);
  expect(await code(await send(undefined, challenge.id))).toEqual([401, 'unauthenticated']);
  expect(await code(await send(korean.cookie, challenge.id))).toEqual([403, 'forbidden']);                   // role korean
  await call(patchSession, makeRequest('PATCH', '/api/session', { cookie: korean.cookie, json: { role: 'learner' } }));
  expect(await code(await send(korean.cookie, challenge.id))).toEqual([403, 'forbidden']);                   // own challenge after switching role
  expect(await code(await send(learner.cookie, '3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11'))).toEqual([404, 'not_found']);
  expect(await code(await send(learner.cookie, challenge.id, mediaFile(mp4Bytes(), 'audio/webm')))).toEqual([415, 'media_invalid']);
  expect(await code(await send(learner.cookie, challenge.id, mediaFile(webmBytes(4_000_001), 'audio/webm')))).toEqual([413, 'audio_too_large']);
  expect(media.paths()).toEqual([]);
});
it('caps answers per day', async () => {
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const target = await newChallenge(korean.cookie);
  const db = await getDb();
  for (let i = 0; i < 30; i++) {
    const [{ id }] = await db.query<{ id: string }>(`insert into hanlog.challenges (code, author_id, korean, meaning_en) values ($1, $2, '가', 'm') returning id`, [`T${1000 + i}Z`, korean.user.id]);
    await db.query(`insert into hanlog.challenge_responses (challenge_id, responder_id, media_path, media_kind, media_mime, duration_ms) values ($1, $2, 'responses/x.webm', 'audio', 'audio/webm', 1000)`, [id, learner.user.id]);
  }
  const res = await send(learner.cookie, target.id);
  expect([res.status, (await res.json()).error.code]).toEqual([429, 'daily_limit']);
});

it('preserves the earlier answer when a replacement upload fails', async () => {
  const store = createMemoryMediaStore();
  setMediaStoreForTests(store);
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const challenge = await newChallenge(korean.cookie);
  const first = (await (await send(learner.cookie, challenge.id)).json()).response;
  let failed = false;
  setMediaStoreForTests({ ...store, put: async (path, bytes, mime) => {
    if (!failed) { failed = true; throw new Error('storage failed'); }
    await store.put(path, bytes, mime);
  } });
  expect((await send(learner.cookie, challenge.id, mediaFile(mp4Bytes(), 'video/mp4'), 'video')).status).toBe(503);
  expect((await view(learner.cookie, challenge.id)).myResponse).toMatchObject({ id: first.id, mediaKind: 'audio', mediaAvailable: true });
  expect(store.paths()).toEqual([`responses/${first.id}.webm`]);
  expect(await store.get(`responses/${first.id}.webm`)).toEqual(webmBytes());
});
it('serializes replacements and starts retention from the new upload', async () => {
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const challenge = await newChallenge(korean.cookie);
  const first = (await (await send(learner.cookie, challenge.id)).json()).response;
  await (await getDb()).query(`update hanlog.challenge_responses set created_at = now() - interval '15 days' where id = $1`, [first.id]);
  expect((await view(learner.cookie, challenge.id)).myResponse.mediaAvailable).toBe(false);
  const replies = await Promise.all([send(learner.cookie, challenge.id), send(learner.cookie, challenge.id, mediaFile(mp4Bytes(), 'video/mp4'), 'video')]);
  expect(replies.map(reply => reply.status)).toEqual([201, 201]);
  const detail = await view(learner.cookie, challenge.id);
  expect(detail.myResponse.mediaAvailable).toBe(true);
  expect(new Date(detail.myResponse.createdAt).getTime()).toBeGreaterThan(Date.now() - 10_000);
  expect(media.paths()).toHaveLength(1);
});
it('does not overwrite rated media', async () => {
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const challenge = await newChallenge(korean.cookie);
  const first = (await (await send(learner.cookie, challenge.id)).json()).response;
  await (await getDb()).query(`update hanlog.challenge_responses set status = 'rated' where id = $1`, [first.id]);
  expect((await send(learner.cookie, challenge.id, mediaFile(mp4Bytes(), 'video/mp4'), 'video')).status).toBe(409);
  expect(await getMediaStore().get(`responses/${first.id}.webm`)).toEqual(webmBytes());
  expect(media.paths()).toEqual([`responses/${first.id}.webm`]);
});
