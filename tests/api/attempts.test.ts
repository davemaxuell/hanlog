import { afterEach, expect, it, vi } from 'vitest';
import { POST, maxDuration } from '@/app/api/missions/[id]/attempts/route';
import { getDb } from '@/lib/db';
import { createTestUser, makeRequest, useTestDb, wavFile } from '../helpers/api';
import { silentWav, toneWav } from '../helpers/audio';
import { call } from './_helpers';

useTestDb();
afterEach(() => vi.unstubAllEnvs());
const send = (cookie: string | undefined, id: string, file?: File) => {
  const form = new FormData();
  if (file) form.set('audio', file);
  return call(POST, makeRequest('POST', `/api/missions/${id}/attempts`, { cookie, form }), { id });
};
const calls = async () => (await getDb()).query<{ outcome: string }>('select outcome from hanlog.scoring_calls order by id');

it('scores, pays, and reports what is left', async () => {
  const { cookie } = await createTestUser();
  const res = await send(cookie, 'cafe-iced-americano', wavFile(toneWav(1500)));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ attempt: { missionId: 'cafe-iced-americano', pointsAwarded: 10, score: { overall: 88, scoredBy: 'mock' } }, balance: 10, bestOverall: 88, attemptsLeftToday: 29 });
  expect((await calls()).map((c) => c.outcome)).toEqual(['scored']);
  expect(maxDuration).toBe(60);
});
it('checks in the order the spec gives', async () => {
  const { cookie } = await createTestUser();
  const code = async (res: Response) => [res.status, (await res.json()).error.code];
  expect(await code(await send(undefined, 'cafe-iced-americano', wavFile(toneWav(1500))))).toEqual([401, 'unauthenticated']);
  expect(await code(await send(cookie, 'no-such-mission', wavFile(toneWav(1500))))).toEqual([404, 'not_found']);
  expect(await code(await send(cookie, 'cafe-iced-americano'))).toEqual([400, 'invalid_input']);
  expect(await code(await send(cookie, 'cafe-iced-americano', wavFile(new Uint8Array(800_000))))).toEqual([413, 'audio_too_large']);
  expect(await code(await send(cookie, 'cafe-iced-americano', wavFile(new Uint8Array(5000).fill(7))))).toEqual([415, 'audio_invalid']);
  expect(await code(await send(cookie, 'cafe-iced-americano', wavFile(toneWav(1000, { sampleRate: 44100 }))))).toEqual([415, 'audio_invalid']);
  expect(await code(await send(cookie, 'cafe-iced-americano', wavFile(toneWav(300))))).toEqual([415, 'audio_invalid']);
  expect(await code(await send(cookie, 'cafe-iced-americano', wavFile(silentWav(1500))))).toEqual([422, 'no_speech']);
  expect(await calls()).toEqual([]);          // nothing above consumed the allowance
});
it('enforces the daily allowance', async () => {
  vi.stubEnv('USER_DAILY_ATTEMPTS', '1');
  const { cookie } = await createTestUser();
  expect((await send(cookie, 'cafe-iced-americano', wavFile(toneWav(1500)))).status).toBe(200);
  const res = await send(cookie, 'cafe-iced-americano', wavFile(toneWav(1500)));
  expect([res.status, (await res.json()).error.code]).toEqual([429, 'daily_limit']);
});
it('rejects ambiguous WAV headers before reserving a scoring call', async () => {
  const { cookie } = await createTestUser();
  const wav = toneWav(1000);
  const duplicateFormat = new Uint8Array(wav.length + 24);
  duplicateFormat.set(wav); duplicateFormat.set(wav.subarray(12, 36), wav.length);
  new DataView(duplicateFormat.buffer).setUint32(4, duplicateFormat.length - 8, true);
  for (const bytes of [duplicateFormat, wav.slice(0, 44 + 600 * 32)]) {
    const response = await send(cookie, 'cafe-iced-americano', wavFile(bytes));
    expect(response.status).toBe(415);
  }
  expect(await calls()).toEqual([]);
});
