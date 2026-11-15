import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/cron/cleanup/route';
import { cleanupExpiredMedia } from '@/lib/media/cleanup';
import { getDb } from '@/lib/db';
import { getMediaStore } from '@/lib/media';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, useMemoryMedia, webmBytes } from './_helpers';
useTestDb();
const media = useMemoryMedia();
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const run = (auth?: string) => call(GET, makeRequest('GET', '/api/cron/cleanup', { headers: auth ? { authorization: auth } : {} }));

async function recordings(ageDays: number, code = 'ABC234') {
  const author = await createTestUser('korean');
  const learner = await createTestUser();
  const db = await getDb();
  const date = new Date(Date.now() - ageDays * 86400000).toISOString();
  const [{ id: challengeId }] = await db.query<{ id: string }>("insert into hanlog.challenges (code,author_id,korean,meaning_en,created_at) values ($1,$2,'안녕하세요','Hello',$3) returning id", [code, author.user.id, date]);
  const reference = `references/${challengeId}.webm`;
  await db.query('update hanlog.challenges set reference_path=$2,reference_mime=$3 where id=$1', [challengeId, reference, 'audio/webm']);
  const [{ id: responseId }] = await db.query<{ id: string }>("insert into hanlog.challenge_responses (challenge_id,responder_id,media_kind,media_mime,duration_ms,created_at) values ($1,$2,'audio','audio/webm',1000,$3) returning id", [challengeId, learner.user.id, date]);
  const answer = `responses/${responseId}.webm`;
  await db.query('update hanlog.challenge_responses set media_path=$2 where id=$1', [responseId, answer]);
  await getMediaStore().put(reference, webmBytes(), 'audio/webm');
  await getMediaStore().put(answer, webmBytes(), 'audio/webm');
  return { challengeId, responseId, reference, answer };
}
it('requires the configured cron bearer secret', async () => {
  expect((await run()).status).toBe(401);
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
  expect((await run()).status).toBe(401);
  expect((await run('Bearer wrong')).status).toBe(401);
});
it('removes expired recordings, clears paths, keeps fresh media, and is idempotent', async () => {
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
  const old = await recordings(15);
  const fresh = await recordings(1, 'ABC235');
  expect(await (await run('Bearer test-cron-secret')).json()).toEqual({ deleted: 2 });
  expect(media.paths()).toEqual([fresh.reference, fresh.answer].sort());
  const db = await getDb();
  expect((await db.query<{ reference_path: string | null }>('select reference_path from hanlog.challenges where id=$1', [old.challengeId]))[0].reference_path).toBeNull();
  expect((await db.query<{ media_path: string | null }>('select media_path from hanlog.challenge_responses where id=$1', [old.responseId]))[0].media_path).toBeNull();
  expect(await (await run('Bearer test-cron-secret')).json()).toEqual({ deleted: 0 });
});
it('retains path records on storage failure so cleanup can retry', async () => {
  const old = await recordings(15);
  vi.spyOn(getMediaStore(), 'remove').mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(cleanupExpiredMedia()).rejects.toThrow();
  const db = await getDb();
  expect((await db.query<{ media_path: string | null }>('select media_path from hanlog.challenge_responses where id=$1', [old.responseId]))[0].media_path).toBe(old.answer);
  expect(await cleanupExpiredMedia()).toBe(2);
});
