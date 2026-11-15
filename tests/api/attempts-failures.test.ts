import { expect, it, vi } from 'vitest';
import { NoSpeechError, ScoringFailedError } from '@/lib/scoring/types';

vi.mock('@/lib/scoring', async (original) => ({ ...(await original<typeof import('@/lib/scoring')>()), scoreAttempt: vi.fn() }));
import { POST } from '@/app/api/missions/[id]/attempts/route';
import { getDb } from '@/lib/db';
import { scoreAttempt } from '@/lib/scoring';
import { createTestUser, makeRequest, useTestDb, wavFile } from '../helpers/api';
import { toneWav } from '../helpers/audio';
import { call } from './_helpers';

useTestDb();
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
