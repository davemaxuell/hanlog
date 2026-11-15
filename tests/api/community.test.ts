import { expect, it } from 'vitest';
import { GET as list } from '@/app/api/challenges/route';
import { GET as detail } from '@/app/api/challenges/[id]/route';
import { GET as inbox } from '@/app/api/community/inbox/route';
import { GET as answers } from '@/app/api/challenges/[id]/responses/route';
import { POST as report } from '@/app/api/responses/[id]/report/route';
import { POST as reportChallenge } from '@/app/api/challenges/[id]/report/route';
import { getDb } from '@/lib/db';
import { reviewReport } from '@/lib/repo/community';
import { rateResponse, giveFeedback } from '@/lib/repo/responses';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, postAnswer, postChallenge, useMemoryMedia } from './_helpers';

useTestDb(); useMemoryMedia();
it('paginates tied challenge timestamps without duplicates and searches beyond the first page', async () => {
  const author = await createTestUser('korean'); const viewer = await createTestUser();
  const db = await getDb();
  for (let i = 0; i < 6; i++) await db.query("insert into hanlog.challenges(code,author_id,korean,meaning_en,created_at) values($1,$2,'안녕하세요',$3,$4)", [`PG222${i + 2}`, author.user.id, `Page ${i}`, `2026-11-15T01:00:00.00000${i + 1}Z`]);
  const page = async (suffix = '') => (await call(list, makeRequest('GET', `/api/challenges?scope=open&limit=2&q=Page${suffix}`, { cookie: viewer.cookie }))).json();
  const one = await page(); const two = await page(`&cursor=${one.nextCursor}`); const three = await page(`&cursor=${two.nextCursor}`);
  expect(one.challenges).toHaveLength(2); expect(new Set([...one.challenges, ...two.challenges, ...three.challenges].map(c => c.id)).size).toBe(6);
  expect(three.nextCursor).toBeNull();
  expect((await call(list, makeRequest('GET', '/api/challenges?cursor=invalid', { cookie: viewer.cookie }))).status).toBe(400);
  expect((await call(list, makeRequest('GET', '/api/challenges?limit=500', { cookie: viewer.cookie }))).status).toBe(400);
});
it('bounds answer pages and restricts them to eligible raters', async () => {
  const author = await createTestUser('korean'); const challenge = await postChallenge(author.cookie);
  const learners = await Promise.all([createTestUser(), createTestUser(), createTestUser()]);
  for (const learner of learners) await postAnswer(learner.cookie, challenge.id);
  const one = await (await call(answers, makeRequest('GET', `/api/challenges/${challenge.id}/responses?limit=2`, { cookie: author.cookie }), { id: challenge.id })).json();
  const two = await (await call(answers, makeRequest('GET', `/api/challenges/${challenge.id}/responses?limit=2&cursor=${one.nextCursor}`, { cookie: author.cookie }), { id: challenge.id })).json();
  expect(one.responses).toHaveLength(2); expect(two.responses).toHaveLength(1); expect(two.nextCursor).toBeNull();
  expect((await call(answers, makeRequest('GET', `/api/challenges/${challenge.id}/responses`, { cookie: learners[0].cookie }), { id: challenge.id })).status).toBe(403);
});
it('opens an older inbox response without widening its audience or unbounding the answer page', async () => {
  const author = await createTestUser('korean'); const learner = await createTestUser(); const stranger = await createTestUser();
  const challenge = await postChallenge(author.cookie); const other = await postChallenge(author.cookie);
  const target = (await (await postAnswer(learner.cookie, challenge.id)).json()).response;
  const db = await getDb();
  await db.query("update hanlog.challenge_responses set created_at='2026-01-01T00:00:00Z' where id=$1", [target.id]);
  for (let index = 0; index < 21; index++) {
    const responder = await createTestUser();
    await db.query("insert into hanlog.challenge_responses(challenge_id,responder_id,media_kind,media_mime,duration_ms) values($1,$2,'audio','audio/wav',2000)", [challenge.id, responder.user.id]);
  }
  const view = (cookie: string, challengeId = challenge.id) => call(detail, makeRequest('GET', `/api/challenges/${challengeId}?response=${target.id}`, { cookie }), { id: challengeId });
  const page = await (await view(author.cookie)).json();
  expect(page.responses).toHaveLength(21); expect(page.responses.map((response: { id: string }) => response.id)).toContain(target.id); expect(page.responsesNextCursor).toBeTruthy();
  expect((await view(stranger.cookie)).status).toBe(404);
  expect((await view(author.cookie, other.id)).status).toBe(404);
  expect((await view(learner.cookie)).status).toBe(200);
  await db.query('update hanlog.challenge_responses set flagged=true where id=$1', [target.id]);
  expect((await view(author.cookie)).status).toBe(404);
});
it('shows only the viewer’s received ratings or feedback and hides reported conversations', async () => {
  const author = await createTestUser('korean'); const learner = await createTestUser(); const stranger = await createTestUser();
  const challenge = await postChallenge(author.cookie);
  const response = (await (await postAnswer(learner.cookie, challenge.id)).json()).response;
  await rateResponse({ responseId: response.id, raterId: author.user.id, pronunciation: 4, naturalness: 5, comment: 'Great rhythm' });
  const load = async (cookie: string) => (await call(inbox, makeRequest('GET', '/api/community/inbox', { cookie }))).json();
  expect((await load(learner.cookie)).items).toEqual([expect.objectContaining({ kind: 'rating', responseId: response.id, needsFeedback: true, comment: 'Great rhythm' })]);
  expect((await load(stranger.cookie)).items).toEqual([]);
  await giveFeedback({ responseId: response.id, responderId: learner.user.id, helpfulness: 5, comment: 'That helped' });
  expect((await load(author.cookie)).items).toEqual([expect.objectContaining({ kind: 'feedback', comment: 'That helped' })]);
  await call(report, makeRequest('POST', `/api/responses/${response.id}/report`, { cookie: author.cookie, json: { reason: 'privacy' } }), { id: response.id });
  expect((await load(learner.cookie)).items).toEqual([]);
});
it('records one audit report per person and target, and supports operator dismissal', async () => {
  const author = await createTestUser('korean'); const learner = await createTestUser(); const stranger = await createTestUser();
  const challenge = await postChallenge(author.cookie); const response = (await (await postAnswer(learner.cookie, challenge.id)).json()).response;
  const submit = (cookie: string, reason = 'privacy') => call(report, makeRequest('POST', `/api/responses/${response.id}/report`, { cookie, json: { reason } }), { id: response.id });
  expect((await submit(stranger.cookie)).status).toBe(403);
  expect((await submit(author.cookie, 'not-a-reason')).status).toBe(400);
  expect((await submit(author.cookie)).status).toBe(204); expect((await submit(author.cookie)).status).toBe(204);
  const db = await getDb(); const reports = await db.query<{ id: string; reason: string }>('select id, reason from hanlog.community_reports');
  expect(reports).toHaveLength(1); expect(reports[0].reason).toBe('privacy');
  await reviewReport(db, reports[0].id, 'dismissed');
  expect((await db.query<{ flagged: boolean }>('select flagged from hanlog.challenge_responses where id=$1', [response.id]))[0].flagged).toBe(false);
  expect((await db.query<{ status: string }>('select status from hanlog.community_reports'))[0].status).toBe('dismissed');
});
it('hides a reported challenge only for its reporter until an operator acts', async () => {
  const author = await createTestUser('korean'); const learner = await createTestUser(); const challenge = await postChallenge(author.cookie);
  const req = (cookie?: string) => call(reportChallenge, makeRequest('POST', `/api/challenges/${challenge.id}/report`, { cookie, json: { reason: 'spam' } }), { id: challenge.id });
  expect((await req()).status).toBe(401); expect((await req(author.cookie)).status).toBe(403); expect((await req(learner.cookie)).status).toBe(204);
  const db = await getDb(); expect((await db.query<{ status: string }>('select status from hanlog.challenges where id=$1', [challenge.id]))[0].status).toBe('open');
  const reports = await db.query<{ id: string }>('select id from hanlog.community_reports where reporter_id=$1', [learner.user.id]); expect(reports).toHaveLength(1);
  const other = await createTestUser();
  const view = (cookie: string) => call(detail, makeRequest('GET', `/api/challenges/${challenge.id}`, { cookie }), { id: challenge.id });
  expect((await view(learner.cookie)).status).toBe(404); expect((await view(other.cookie)).status).toBe(200); expect((await view(author.cookie)).status).toBe(200);
  const feed = await (await call(list, makeRequest('GET', '/api/challenges', { cookie: learner.cookie }))).json();
  expect(feed.challenges.map((c: { id: string }) => c.id)).not.toContain(challenge.id);
  expect(feed.challenges.filter((c: { isSample: boolean }) => c.isSample)).toHaveLength(8);
  await reviewReport(db, reports[0].id, 'actioned'); expect((await view(other.cookie)).status).toBe(404);
  await reviewReport(db, reports[0].id, 'dismissed'); expect((await view(learner.cookie)).status).toBe(200);
});
it('caps reports across answer and challenge targets while keeping retries idempotent', async () => {
  const author = await createTestUser('korean'); const reporter = await createTestUser(); const db = await getDb();
  const challenge = await postChallenge(author.cookie);
  const response = (await (await postAnswer(reporter.cookie, challenge.id)).json()).response;
  expect((await call(report, makeRequest('POST', `/api/responses/${response.id}/report`, { cookie: reporter.cookie, json: { reason: 'privacy' } }), { id: response.id })).status).toBe(204);
  const ids: string[] = [];
  for (let i = 0; i < 10; i++) {
    const [row] = await db.query<{ id: string }>("insert into hanlog.challenges(code,author_id,korean,meaning_en) values($1,$2,'안녕','Hello') returning id", [`RP22${String(i).padStart(2, '2')}`, author.user.id]); ids.push(row.id);
  }
  for (const id of ids.slice(0, 9)) expect((await call(reportChallenge, makeRequest('POST', `/api/challenges/${id}/report`, { cookie: reporter.cookie, json: { reason: 'spam' } }), { id })).status).toBe(204);
  expect((await call(reportChallenge, makeRequest('POST', `/api/challenges/${ids[9]}/report`, { cookie: reporter.cookie, json: { reason: 'spam' } }), { id: ids[9] })).status).toBe(429);
  expect((await call(reportChallenge, makeRequest('POST', `/api/challenges/${ids[0]}/report`, { cookie: reporter.cookie, json: { reason: 'spam' } }), { id: ids[0] })).status).toBe(204);
});
it('keeps a recording hidden while another person’s report remains active', async () => {
  const author = await createTestUser('korean'); const learner = await createTestUser();
  const challenge = await postChallenge(author.cookie); const response = (await (await postAnswer(learner.cookie, challenge.id)).json()).response;
  for (const cookie of [author.cookie, learner.cookie]) expect((await call(report, makeRequest('POST', `/api/responses/${response.id}/report`, { cookie, json: { reason: 'privacy' } }), { id: response.id })).status).toBe(204);
  const db = await getDb(); const reports = await db.query<{ id: string }>('select id from hanlog.community_reports where response_id=$1', [response.id]);
  expect(reports).toHaveLength(2);
  const flagged = async () => (await db.query<{ flagged: boolean }>('select flagged from hanlog.challenge_responses where id=$1', [response.id]))[0].flagged;
  await reviewReport(db, reports[0].id, 'dismissed'); expect(await flagged()).toBe(true);
  await reviewReport(db, reports[1].id, 'dismissed'); expect(await flagged()).toBe(false);
});
