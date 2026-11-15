import { expect, it, vi } from 'vitest';
import { NoSpeechError, ScoringFailedError } from '@/lib/scoring/types';

vi.mock('@/lib/scoring', async (original) => ({ ...(await original<typeof import('@/lib/scoring')>()), scoreAttempt: vi.fn() }));
import { POST } from '@/app/api/missions/[id]/attempts/route';
import { getDb, setDbForTests, type Db } from '@/lib/db';
import type { Score } from '@/lib/contracts';
import { revokeSessions } from '@/lib/repo/accounts';
import { cleanupExpiredMedia } from '@/lib/media/cleanup';
import { scoreAttempt } from '@/lib/scoring';
import { createTestUser, makeRequest, useTestDb, wavFile } from '../helpers/api';
import { toneWav } from '../helpers/audio';
import { call } from './_helpers';

useTestDb();
const assessed: Score = { overall: 88, pronunciation: 88, accuracy: 88, usage: 88, heard: '아이스 아메리카노 한 잔 주세요.', issues: [], praise: 'Clear.', nextTip: 'Keep practising.', scoredBy: 'mock' };
const send = async (cookie: string) => {
  const form = new FormData();
  form.set('audio', wavFile(toneWav(1500)));
  return call(POST, makeRequest('POST', '/api/missions/cafe-iced-americano/attempts', { cookie, form }), { id: 'cafe-iced-americano' });
};
const state = async () => {
  const db = await getDb();
  return { outcomes: (await db.query<{ outcome: string }>('select outcome from hanlog.scoring_calls')).map((r) => r.outcome), attempts: (await db.query<{ n: number }>('select count(*)::int as n from hanlog.attempts'))[0].n };
};

it('answers 502 and records the failure when the scorer fails', async () => {
  vi.mocked(scoreAttempt).mockRejectedValueOnce(new ScoringFailedError('down'));
  const res = await send((await createTestUser()).cookie);
  expect([res.status, (await res.json()).error.code]).toEqual([502, 'scoring_failed']);
  expect(await state()).toEqual({ outcomes: ['failed'], attempts: 0 });
});
it('answers 422 when the scorer hears nothing', async () => {
  vi.mocked(scoreAttempt).mockRejectedValueOnce(new NoSpeechError());
  const res = await send((await createTestUser()).cookie);
  expect([res.status, (await res.json()).error.code]).toEqual([422, 'no_speech']);
  expect(await state()).toEqual({ outcomes: ['no_speech'], attempts: 0 });
});
it('answers 502 and records the failure on an unexpected scorer error', async () => {
  vi.mocked(scoreAttempt).mockRejectedValueOnce(new Error('surprise'));
  const res = await send((await createTestUser()).cookie);
  expect(res.status).toBe(502);
  expect((await state()).outcomes).toEqual(['failed']);
});
it('does not spend an allowance when the session is revoked during request parsing', async () => {
  const { user, cookie } = await createTestUser();
  vi.mocked(scoreAttempt).mockReset().mockResolvedValue(assessed);
  const form = new FormData(); form.set('audio', wavFile(toneWav(1500)));
  const response = await POST(makeRequest('POST', '/api/missions/cafe-iced-americano/attempts', { cookie, form }), {
    get params() { return revokeSessions(user.id, 0).then(() => ({ id: 'cafe-iced-americano' })); },
  });
  expect(response.status).toBe(401);
  expect(scoreAttempt).not.toHaveBeenCalled();
  expect(await state()).toEqual({ outcomes: [], attempts: 0 });
});
it('does not write a late score after the session was revoked while scoring', async () => {
  const { user, cookie } = await createTestUser();
  vi.mocked(scoreAttempt).mockReset().mockImplementationOnce(async () => { await revokeSessions(user.id, 0); return assessed; });
  const response = await send(cookie);
  expect(response.status).toBe(401);
  expect(await state()).toEqual({ outcomes: ['failed'], attempts: 0 });
});
it('rolls back the score and points if completing the call record fails', async () => {
  const { cookie } = await createTestUser(); const db = await getDb();
  vi.mocked(scoreAttempt).mockReset().mockResolvedValue(assessed);
  const wrap = (delegate: Db): Db => ({
    query: async <T>(sql: string, params?: unknown[]) => {
      if (/update hanlog.scoring_calls/.test(sql) && (sql.includes("'scored'") || params?.includes('scored'))) throw new Error('simulated bookkeeping outage');
      return delegate.query<T>(sql, params);
    },
    tx: fn => delegate.tx(tx => fn(wrap(tx))),
  });
  setDbForTests(wrap(db));
  try {
    expect((await send(cookie)).status).toBe(500);
    expect((await state()).attempts).toBe(0);
    expect(await db.query('select id from hanlog.point_events')).toEqual([]);
  } finally { setDbForTests(db); }
});
it('commits a valid score when cleanup runs across midnight during scoring', async () => {
  const { user, cookie } = await createTestUser(); const db = await getDb();
  vi.mocked(scoreAttempt).mockReset().mockImplementationOnce(async () => {
    // The paid-call reservation was created just before the Korea-time day changed.
    await db.query("update hanlog.scoring_calls set created_at='2026-11-15T14:59:59Z' where user_id=$1", [user.id]);
    await cleanupExpiredMedia(new Date('2026-11-15T15:00:10Z'));
    return assessed;
  });
  const response = await send(cookie);
  expect(response.status).toBe(200);
  expect((await response.json()).attempt.pointsAwarded).toBeGreaterThan(0);
  expect(await state()).toEqual({ outcomes: ['scored'], attempts: 1 });
  expect(await db.query('select id from hanlog.point_events where user_id=$1', [user.id])).toHaveLength(1);
});
