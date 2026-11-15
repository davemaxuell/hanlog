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

it('expires recovery throttle address hashes after one day while retaining active limits', async () => {
  const db = await getDb();
  await db.query("insert into hanlog.recovery_attempt_limits (ip_hash,window_start,attempts) values ('expired',$1,10),('active',$2,10)", ['2026-11-14T15:59:59Z', '2026-11-15T15:50:00Z']);
  const { user } = await createTestUser();
  await db.query("update hanlog.users set recovery_previous_hash = 'previous', recovery_request_hash = 'nonce', recovery_retry_expires_at = $2, recovery_retry_version = 0 where id = $1", [user.id, '2026-11-15T15:59:00Z']);
  await cleanupExpiredMedia(new Date('2026-11-15T16:00:00Z'));
  expect((await db.query<{ ip_hash: string }>('select ip_hash from hanlog.recovery_attempt_limits')).map(row => row.ip_hash)).toEqual(['active']);
  expect((await db.query('select recovery_previous_hash,recovery_request_hash,recovery_retry_expires_at,recovery_retry_version from hanlog.users where id = $1', [user.id]))[0]).toEqual({ recovery_previous_hash: null, recovery_request_hash: null, recovery_retry_expires_at: null, recovery_retry_version: null });
});

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

it('purges spending counters from prior Korea-time days and keeps today', async () => {
  const { user } = await createTestUser();
  const db = await getDb();
  await db.query('insert into hanlog.scoring_calls (user_id, ip_hash, created_at) values ($1,$2,$3),($1,$4,$5)', [user.id, 'old', '2026-11-15T14:59:59Z', 'today', '2026-11-15T15:00:00Z']);
  expect(await cleanupExpiredMedia(new Date('2026-11-15T16:00:00Z'))).toBe(0);
  expect((await db.query<{ ip_hash: string }>('select ip_hash from hanlog.scoring_calls')).map(r => r.ip_hash)).toEqual(['today']);
});

it('preserves in-flight scoring across midnight while expiring old completed and abandoned calls', async () => {
  const { user } = await createTestUser(); const db = await getDb();
  await db.query(`insert into hanlog.scoring_calls(user_id,ip_hash,created_at,outcome) values
    ($1,'fresh-pending','2026-11-15T14:59:59Z','pending'),
    ($1,'old-pending','2026-11-15T13:59:59Z','pending'),
    ($1,'completed','2026-11-15T14:59:59Z','scored'),
    ($1,'failed','2026-11-15T14:59:59Z','failed'),
    ($1,'no-speech','2026-11-15T14:59:59Z','no_speech'),
    ($1,'today-pending','2026-11-15T15:00:01Z','pending'),
    ($1,'today-scored','2026-11-15T15:00:01Z','scored')`, [user.id]);
  await cleanupExpiredMedia(new Date('2026-11-15T15:00:10Z'));
  expect(await db.query('select ip_hash from hanlog.scoring_calls order by ip_hash')).toEqual([
    { ip_hash: 'fresh-pending' }, { ip_hash: 'today-pending' }, { ip_hash: 'today-scored' },
  ]);
});

it('purges expired creation counters at the Korea-time day boundary', async () => {
  const db = await getDb();
  await db.query("insert into hanlog.session_creation_limits (ip_hash,day,sessions) values ('old','2026-11-15',1),('today','2026-11-16',1)");
  await cleanupExpiredMedia(new Date('2026-11-15T14:59:59Z'));
  expect(await db.query('select ip_hash from hanlog.session_creation_limits')).toHaveLength(2);
  await cleanupExpiredMedia(new Date('2026-11-15T15:00:00Z'));
  expect(await db.query('select ip_hash from hanlog.session_creation_limits')).toEqual([{ ip_hash: 'today' }]);
});
