import { expect, it } from 'vitest';
import { POST as feedback } from '@/app/api/responses/[id]/feedback/route';
import { POST as rating } from '@/app/api/responses/[id]/rating/route';
import { POST as report } from '@/app/api/responses/[id]/report/route';
import { getSampleChallenges } from '@/lib/content';
import { PATCH as patchSession } from '@/app/api/session/route';
import { getPoints } from '@/lib/repo/points';
import { deleteUserCascade } from '@/lib/repo/users';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, listScope, postAnswer, postChallenge, useMemoryMedia, viewChallenge } from './_helpers';

useTestDb();
useMemoryMedia();
const rate = (cookie: string | undefined, id: string, json: unknown = { pronunciation: 4, naturalness: 5, comment: '좋아요!' }) => call(rating, makeRequest('POST', `/api/responses/${id}/rating`, { cookie, json }), { id });
const thank = (cookie: string | undefined, id: string, json: unknown = { helpfulness: 5, comment: 'Thanks!' }) => call(feedback, makeRequest('POST', `/api/responses/${id}/feedback`, { cookie, json }), { id });
const flag = (cookie: string | undefined, id: string) => call(report, makeRequest('POST', `/api/responses/${id}/report`, { cookie }), { id });
const code = async (res: Response) => [res.status, (await res.json()).error.code];
const setup = async () => {
  const korean = await createTestUser('korean', 'Minji');
  const learner = await createTestUser('learner', 'Aisha');
  const challenge = await postChallenge(korean.cookie);
  const { response } = await (await postAnswer(learner.cookie, challenge.id)).json();
  return { korean, learner, challenge, response };
};

it('rates once and pays both people', async () => {
  const { korean, learner, response } = await setup();
  const res = await rate(korean.cookie, response.id);
  expect(res.status).toBe(200);
  expect((await res.json()).response).toMatchObject({ status: 'rated', rating: { pronunciation: 4, naturalness: 5, comment: '좋아요!' } });
  expect(await getPoints(learner.user.id)).toMatchObject({ balance: 27, events: [{ delta: 27, reason: 'peer_response', label: 'Your answer was rated' }] });
  expect(await getPoints(korean.user.id)).toMatchObject({ balance: 10, events: [{ delta: 10, reason: 'peer_rating', label: 'You rated an answer' }] });
  expect(await code(await rate(korean.cookie, response.id))).toEqual([409, 'conflict']);
  expect((await getPoints(learner.user.id)).balance).toBe(27);
});
it('only lets the right person rate', async () => {
  const { korean, learner, response } = await setup();
  expect(await code(await rate(undefined, response.id))).toEqual([401, 'unauthenticated']);
  expect(await code(await rate(learner.cookie, response.id))).toEqual([403, 'forbidden']);
  expect(await code(await rate((await createTestUser('korean')).cookie, response.id))).toEqual([403, 'forbidden']);
  expect(await code(await rate((await createTestUser('learner')).cookie, response.id))).toEqual([403, 'forbidden']);
  expect(await code(await rate(korean.cookie, '3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11'))).toEqual([404, 'not_found']);
  expect(await code(await rate(korean.cookie, response.id, { pronunciation: 0, naturalness: 5, comment: '' }))).toEqual([400, 'invalid_input']);
  expect(await code(await rate(korean.cookie, response.id, { pronunciation: 3, naturalness: 3, comment: 'visit www.x.example' }))).toEqual([422, 'content_rejected']);
});
it('lets any Korean speaker rate an answer to a sample', async () => {
  const learner = await createTestUser('learner');
  const anyKorean = await createTestUser('korean');
  const sample = (await viewChallenge(learner.cookie, getSampleChallenges()[0].code)).challenge;
  const { response } = await (await postAnswer(learner.cookie, sample.id)).json();
  expect((await rate(anyKorean.cookie, response.id)).status).toBe(200);
  expect((await getPoints(anyKorean.user.id)).balance).toBe(10);
});
it('takes feedback once, after the rating, from the responder only', async () => {
  const { korean, learner, response } = await setup();
  expect(await code(await thank(learner.cookie, response.id))).toEqual([409, 'conflict']);          // not rated yet
  await rate(korean.cookie, response.id);
  expect(await code(await thank(korean.cookie, response.id))).toEqual([403, 'forbidden']);
  expect(await code(await thank(learner.cookie, response.id, { helpfulness: 6, comment: '' }))).toEqual([400, 'invalid_input']);
  const res = await thank(learner.cookie, response.id);
  expect((await res.json()).response.feedback).toMatchObject({ helpfulness: 5, comment: 'Thanks!' });
  expect((await getPoints(learner.user.id)).events[0]).toMatchObject({ delta: 5, reason: 'peer_feedback', label: 'Thanks for your feedback' });
  expect((await getPoints(korean.user.id)).events[0]).toMatchObject({ delta: 10, reason: 'peer_feedback', label: 'Feedback on your rating' });
  expect(await code(await thank(learner.cookie, response.id))).toEqual([409, 'conflict']);
});
it('still accepts feedback after the rater deleted their account', async () => {
  const learner = await createTestUser('learner');
  const rater = await createTestUser('korean');
  const sample = (await viewChallenge(learner.cookie, getSampleChallenges()[0].code)).challenge;
  const { response } = await (await postAnswer(learner.cookie, sample.id)).json();
  await rate(rater.cookie, response.id);
  await deleteUserCascade(rater.user.id);
  expect((await thank(learner.cookie, response.id)).status).toBe(200);
});
it('hides a reported answer everywhere', async () => {
  const { korean, learner, challenge, response } = await setup();
  expect(await code(await flag((await createTestUser('learner')).cookie, response.id))).toEqual([403, 'forbidden']);
  expect((await flag(korean.cookie, response.id)).status).toBe(204);
  expect((await viewChallenge(korean.cookie, challenge.id)).responses).toEqual([]);
  expect(await listScope(korean.cookie, 'to-rate')).toEqual([]);
  expect(await code(await rate(korean.cookie, response.id))).toEqual([404, 'not_found']);
  expect((await viewChallenge(learner.cookie, challenge.id)).myResponse).toMatchObject({ id: response.id, mediaAvailable: false });
});

it('pays rating and feedback once under concurrent requests', async () => {
  const { korean, learner, response } = await setup();
  const ratings = await Promise.all([rate(korean.cookie, response.id), rate(korean.cookie, response.id)]);
  expect(ratings.map(result => result.status).sort()).toEqual([200, 409]);
  const feedbacks = await Promise.all([thank(learner.cookie, response.id), thank(learner.cookie, response.id)]);
  expect(feedbacks.map(result => result.status).sort()).toEqual([200, 409]);
  expect((await getPoints(learner.user.id)).balance).toBe(32);
  expect((await getPoints(korean.user.id)).balance).toBe(20);
});
it('prevents a responder rating their own sample answer after switching role', async () => {
  const learner = await createTestUser('learner');
  const sample = (await viewChallenge(learner.cookie, getSampleChallenges()[0].code)).challenge;
  const { response } = await (await postAnswer(learner.cookie, sample.id)).json();
  await call(patchSession, makeRequest('PATCH', '/api/session', { cookie: learner.cookie, json: { role: 'korean' } }));
  expect((await rate(learner.cookie, response.id)).status).toBe(403);
  expect((await getPoints(learner.user.id)).balance).toBe(0);
});
