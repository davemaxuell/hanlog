import { expect, it } from 'vitest';
import { GET as responseMedia } from '@/app/api/responses/[id]/media/route';
import { POST as rating } from '@/app/api/responses/[id]/rating/route';
import { POST as feedback } from '@/app/api/responses/[id]/feedback/route';
import { POST as report } from '@/app/api/responses/[id]/report/route';
import { POST as newChallenge } from '@/app/api/challenges/route';
import { POST as answer } from '@/app/api/challenges/[id]/responses/route';
import { POST as reportChallenge } from '@/app/api/challenges/[id]/report/route';
import { getDb } from '@/lib/db';
import { getSampleChallenges } from '@/lib/content';
import { createChallenge } from '@/lib/repo/challenges';
import { reportCommunityTarget, reviewReport } from '@/lib/repo/community';
import { rateResponse, upsertResponse } from '@/lib/repo/responses';
import { updateUser } from '@/lib/repo/users';
import { revokeSessions } from '@/lib/repo/accounts';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, mediaFile, postAnswer, postChallenge, useMemoryMedia, viewChallenge, webmBytes } from './_helpers';

useTestDb();
const media = useMemoryMedia();

it('blocks direct response endpoints after the viewer hides its challenge, until dismissal', async () => {
  const author = await createTestUser('korean'); const learner = await createTestUser();
  const challenge = await postChallenge(author.cookie);
  const response = (await (await postAnswer(learner.cookie, challenge.id)).json()).response;
  await rateResponse({ responseId: response.id, raterId: author.user.id, pronunciation: 4, naturalness: 4, comment: '' });
  await reportCommunityTarget(learner.user, { challengeId: challenge.id, reason: 'privacy' });
  const load = (cookie: string) => call(responseMedia, makeRequest('GET', `/api/responses/${response.id}/media`, { cookie }), { id: response.id });
  expect((await load(learner.cookie)).status).toBe(404);
  expect((await call(feedback, makeRequest('POST', `/api/responses/${response.id}/feedback`, { cookie: learner.cookie, json: { helpfulness: 5, comment: '' } }), { id: response.id })).status).toBe(404);
  expect((await call(report, makeRequest('POST', `/api/responses/${response.id}/report`, { cookie: learner.cookie, json: { reason: 'privacy' } }), { id: response.id })).status).toBe(404);
  expect((await load(author.cookie)).status).toBe(200);
  const db = await getDb(); const [audit] = await db.query<{ id: string }>('select id from hanlog.community_reports where reporter_id=$1', [learner.user.id]);
  await reviewReport(db, audit.id, 'dismissed');
  expect((await load(learner.cookie)).status).toBe(200);
});

it('prevents a sample rater from rating a challenge they have hidden', async () => {
  const learner = await createTestUser(); const rater = await createTestUser('korean');
  const challenge = (await viewChallenge(learner.cookie, getSampleChallenges()[0].code)).challenge;
  const response = (await (await postAnswer(learner.cookie, challenge.id)).json()).response;
  await reportCommunityTarget(rater.user, { challengeId: challenge.id, reason: 'spam' });
  expect((await call(rating, makeRequest('POST', `/api/responses/${response.id}/rating`, { cookie: rater.cookie, json: { pronunciation: 4, naturalness: 4, comment: '' } }), { id: response.id })).status).toBe(404);
  const db = await getDb();
  expect(await db.query('select id from hanlog.point_events where user_id=$1', [rater.user.id])).toEqual([]);
});

it('rechecks the current role before creating a challenge after request authorization', async () => {
  const author = await createTestUser('korean');
  await updateUser(author.user.id, { role: 'learner' });
  await expect(createChallenge({ authorId: author.user.id, korean: '안녕하세요', meaningEn: 'Hello', situationEn: '' })).rejects.toMatchObject({ code: 'forbidden' });
});

it('rechecks the current role before accepting answer bytes after request authorization', async () => {
  const author = await createTestUser('korean'); const learner = await createTestUser();
  const challenge = await postChallenge(author.cookie);
  await updateUser(learner.user.id, { role: 'korean' });
  await expect(upsertResponse({ challengeId: challenge.id, responderId: learner.user.id, mediaKind: 'audio', mediaMime: 'audio/webm', ext: 'webm', durationMs: 3001, bytes: webmBytes() })).rejects.toMatchObject({ code: 'forbidden' });
  expect(media.paths()).toEqual([]);
});

it('rechecks a sample reporter’s current role after request authorization', async () => {
  const learner = await createTestUser(); const rater = await createTestUser('korean');
  const challenge = (await viewChallenge(learner.cookie, getSampleChallenges()[0].code)).challenge;
  const response = (await (await postAnswer(learner.cookie, challenge.id)).json()).response;
  await updateUser(rater.user.id, { role: 'learner' });
  await expect(reportCommunityTarget(rater.user, { responseId: response.id, reason: 'privacy' })).rejects.toMatchObject({ code: 'forbidden' });
  expect(await (await getDb()).query('select id from hanlog.community_reports')).toEqual([]);
});

it.each(['challenge', 'answer', 'rating', 'feedback', 'challenge-report', 'answer-report'] as const)('rejects a revoked session before committing an in-flight %s request', async kind => {
  const author = await createTestUser('korean'); const learner = await createTestUser();
  const challenge = await postChallenge(author.cookie);
  const response = (await (await postAnswer(learner.cookie, challenge.id)).json()).response;
  if (kind === 'feedback') await rateResponse({ responseId: response.id, raterId: author.user.id, pronunciation: 4, naturalness: 4, comment: '' });
  const db = await getDb();
  const snapshot = () => Promise.all([
    db.query('select id,reference_path from hanlog.challenges where author_id=$1 order by id', [author.user.id]),
    db.query('select media_path,status,rated_at,feedback_at from hanlog.challenge_responses where id=$1', [response.id]),
    db.query('select id from hanlog.point_events order by id'),
    db.query('select id from hanlog.community_reports order by id'),
  ]);
  const before = await snapshot(); const beforePaths = media.paths();
  const actor = kind === 'challenge' || kind === 'rating' ? author : learner;
  const form = new FormData();
  form.set('korean', '안녕하세요'); form.set('meaningEn', 'Hello');
  form.set('media', mediaFile(webmBytes(), 'audio/webm')); form.set('kind', 'audio'); form.set('durationMs', '3000');
  const target = kind === 'challenge' ? { route: newChallenge, path: '/api/challenges', id: undefined }
    : kind === 'answer' ? { route: answer, path: `/api/challenges/${challenge.id}/responses`, id: challenge.id }
      : kind === 'challenge-report' ? { route: reportChallenge, path: `/api/challenges/${challenge.id}/report`, id: challenge.id }
        : { route: kind === 'rating' ? rating : kind === 'feedback' ? feedback : report, path: `/api/responses/${response.id}/${kind}`, id: response.id };
  const original = makeRequest('POST', target.path, { cookie: actor.cookie, ...(kind === 'challenge' || kind === 'answer' ? { form } : { json: { pronunciation: 4, naturalness: 4, helpfulness: 5, comment: '', reason: 'privacy' } }) });
  const bytes = new Uint8Array(await original.arrayBuffer());
  // Pull only when the handler consumes its body, after its initial authentication.
  const body = new ReadableStream<Uint8Array>({ async pull(controller) { await revokeSessions(actor.user.id, 0); controller.enqueue(bytes); controller.close(); } }, { highWaterMark: 0 });
  const request = new Request(original.url, { method: 'POST', headers: original.headers, body, duplex: 'half' } as RequestInit);
  const result = await call(target.route, request, target.id ? { id: target.id } : undefined);
  expect(result.status).toBe(401);
  expect((await result.json()).error.code).toBe('unauthenticated');
  expect(await snapshot()).toEqual(before);
  expect(media.paths()).toEqual(beforePaths);
});
