import { expect, it } from 'vitest';
import { GET as reference } from '@/app/api/challenges/[id]/reference/route';
import { GET as responseMedia } from '@/app/api/responses/[id]/media/route';
import { getDb } from '@/lib/db';
import { getSampleChallenges } from '@/lib/content';
import { getMediaStore } from '@/lib/media';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, mediaFile, postAnswer, postChallenge, useMemoryMedia, viewChallenge, webmBytes } from './_helpers';

useTestDb();
useMemoryMedia();
const fetchMedia = (cookie: string | undefined, id: string) => call(responseMedia, makeRequest('GET', `/api/responses/${id}/media`, { cookie }), { id });

it('serves an answer to the people entitled to it, with safe headers', async () => {
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const challenge = await postChallenge(korean.cookie);
  const bytes = webmBytes(1234);
  const { response } = await (await postAnswer(learner.cookie, challenge.id, mediaFile(bytes, 'audio/webm;codecs=opus'))).json();
  for (const cookie of [korean.cookie, learner.cookie]) {
    const res = await fetchMedia(cookie, response.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/webm');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  }
  expect((await fetchMedia(undefined, response.id)).status).toBe(401);
  expect((await fetchMedia((await createTestUser('learner')).cookie, response.id)).status).toBe(403);
  expect((await fetchMedia((await createTestUser('korean')).cookie, response.id)).status).toBe(403);
});
it('answers 404 for reported, missing, or unknown media', async () => {
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const challenge = await postChallenge(korean.cookie);
  const a = (await (await postAnswer(learner.cookie, challenge.id)).json()).response;
  await getMediaStore().remove([`responses/${a.id}.webm`]);                  // file gone, row still points at it
  expect((await fetchMedia(korean.cookie, a.id)).status).toBe(404);
  await (await getDb()).query('update hanlog.challenge_responses set flagged = true where id = $1', [a.id]);
  expect((await fetchMedia(learner.cookie, a.id)).status).toBe(404);
  expect((await fetchMedia(korean.cookie, '3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11')).status).toBe(404);
});

it('withholds expired and hidden recordings before cleanup runs', async () => {
  const korean = await createTestUser('korean');
  const learner = await createTestUser();
  const challenge = await postChallenge(korean.cookie, { media: mediaFile(webmBytes(), 'audio/webm'), durationMs: '1000' });
  const answer = (await (await postAnswer(learner.cookie, challenge.id)).json()).response;
  const db = await getDb();
  await db.query("update hanlog.challenges set created_at = now() - interval '15 days' where id = $1", [challenge.id]);
  await db.query("update hanlog.challenge_responses set created_at = now() - interval '15 days' where id = $1", [answer.id]);
  expect((await fetchMedia(korean.cookie, answer.id)).status).toBe(404);
  expect((await call(reference, makeRequest('GET', `/api/challenges/${challenge.id}/reference`, { cookie: learner.cookie }), { id: challenge.id })).status).toBe(404);
  await db.query('update hanlog.challenges set created_at = now(), status = $2 where id = $1', [challenge.id, 'hidden']);
  await db.query('update hanlog.challenge_responses set created_at = now() where id = $1', [answer.id]);
  expect((await fetchMedia(korean.cookie, answer.id)).status).toBe(404);
  expect((await call(reference, makeRequest('GET', `/api/challenges/${challenge.id}/reference`, { cookie: learner.cookie }), { id: challenge.id })).status).toBe(404);
});

it('serves sample answers to Korean raters and returns 404 for malformed identifiers', async () => {
  const korean = await createTestUser('korean');
  const learner = await createTestUser();
  const sample = (await viewChallenge(learner.cookie, getSampleChallenges()[0].code)).challenge;
  const answer = (await (await postAnswer(learner.cookie, sample.id)).json()).response;
  expect((await fetchMedia(korean.cookie, answer.id)).status).toBe(200);
  expect((await fetchMedia(learner.cookie, 'malformed')).status).toBe(404);
  expect((await call(reference, makeRequest('GET', '/api/challenges/malformed/reference', { cookie: learner.cookie }), { id: 'malformed' })).status).toBe(404);
});
it('serves a reference clip to any signed-in user', async () => {
  const korean = await createTestUser('korean');
  const withClip = await postChallenge(korean.cookie, { media: mediaFile(webmBytes(500), 'audio/webm'), durationMs: '2000' });
  const without = await postChallenge(korean.cookie);
  const get = (cookie: string | undefined, id: string) => call(reference, makeRequest('GET', `/api/challenges/${id}/reference`, { cookie }), { id });
  const res = await get((await createTestUser('learner')).cookie, withClip.id);
  expect([res.status, res.headers.get('content-type'), (await res.arrayBuffer()).byteLength]).toEqual([200, 'audio/webm', 500]);
  expect((await get(korean.cookie, without.id)).status).toBe(404);
  expect((await get(undefined, withClip.id)).status).toBe(401);
});
