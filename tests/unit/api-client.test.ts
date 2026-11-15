import { afterEach, expect, it, vi } from 'vitest';
import { ApiClientError, api } from '@/lib/api-client';
import { AttemptResultSchema, ChallengeDetailSchema, UserSchema } from '@/lib/contracts';
import { samples } from '../fixtures/api/samples';
import { toneWav } from '../helpers/audio';

const respond = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
afterEach(() => vi.unstubAllGlobals());

it('fixtures match the contracts', () => {
  expect(UserSchema.safeParse(samples.user).success).toBe(true);
  expect(AttemptResultSchema.safeParse(samples.attemptResult).success).toBe(true);
  expect(ChallengeDetailSchema.safeParse(samples.challengeDetailForAuthor).success).toBe(true);
});
it('returns null when there is no session', async () => {
  vi.stubGlobal('fetch', respond(200, { user: null }));
  expect(await api.getSession()).toBeNull();
});
it('creates a session with consent and same-origin credentials', async () => {
  const fetchMock = respond(201, { user: samples.user });
  vi.stubGlobal('fetch', fetchMock);
  expect(await api.createSession({ nickname: 'Aisha', role: 'learner' })).toEqual(samples.user);
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('/api/session');
  expect(init.method).toBe('POST');
  expect(init.credentials).toBe('same-origin');
  expect(JSON.parse(init.body as string)).toEqual({ nickname: 'Aisha', role: 'learner', consent: true });
});
it('uploads a WAV as multipart field "audio"', async () => {
  const fetchMock = respond(200, samples.attemptResult);
  vi.stubGlobal('fetch', fetchMock);
  await api.submitAttempt('cafe-iced-americano', toneWav(600));
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('/api/missions/cafe-iced-americano/attempts');
  const file = (init.body as FormData).get('audio') as File;
  expect(file.type).toBe('audio/wav');
  expect(file.size).toBe(44 + 600 * 32);
});
it('turns error bodies into ApiClientError', async () => {
  vi.stubGlobal('fetch', respond(429, { error: { code: 'daily_limit', message: 'x' } }));
  await expect(api.getPoints()).rejects.toMatchObject({ code: 'daily_limit', status: 429 });
  expect(await api.getPoints().catch((e) => e)).toBeInstanceOf(ApiClientError);
});
it('maps non-JSON failures and network failures to internal', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })));
  await expect(api.listRewards()).rejects.toMatchObject({ code: 'internal', status: 502 });
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
  await expect(api.listRewards()).rejects.toMatchObject({ code: 'internal', status: 0 });
});
it('builds media URLs and encodes path segments', () => {
  expect(api.mediaUrl.response('abc')).toBe('/api/responses/abc/media');
  expect(api.mediaUrl.reference('abc')).toBe('/api/challenges/abc/reference');
});
