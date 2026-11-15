import { afterEach, expect, it, vi } from 'vitest';
import { assertTextAllowed } from '@/lib/moderation';

afterEach(() => vi.unstubAllEnvs());
const reply = (flags: boolean[]) => vi.fn(async () => new Response(JSON.stringify({ results: flags.map((flagged) => ({ flagged })) }), { status: 200 }));

it('rejects links without calling anyone', async () => {
  const f = reply([false]);
  await expect(assertTextAllowed(['join www.spam.example'], { fetchImpl: f as unknown as typeof fetch })).rejects.toMatchObject({ code: 'content_rejected' });
  expect(f).not.toHaveBeenCalled();
});
it('passes clean text offline when no key is configured', async () => {
  const f = reply([true]);
  await expect(assertTextAllowed(['오늘 점메추 좀 해 줘.', ''], { fetchImpl: f as unknown as typeof fetch })).resolves.toBeUndefined();
  expect(f).not.toHaveBeenCalled();
});
it('asks the moderation endpoint when a key is configured', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  const f = reply([false, false]);
  await assertTextAllowed(['hello', '', '안녕'], { fetchImpl: f as unknown as typeof fetch });
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.openai.com/v1/moderations');
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  expect(JSON.parse(init.body as string)).toEqual({ model: 'omni-moderation-latest', input: ['hello', '안녕'] });
});
it('rejects flagged text and fails closed when the service is down', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  await expect(assertTextAllowed(['a', 'b'], { fetchImpl: reply([false, true]) as unknown as typeof fetch })).rejects.toMatchObject({ code: 'content_rejected' });
  await expect(assertTextAllowed(['a'], { fetchImpl: vi.fn(async () => new Response('{}', { status: 500 })) as unknown as typeof fetch })).rejects.toMatchObject({ code: 'service_unavailable' });
  await expect(assertTextAllowed(['a'], { fetchImpl: vi.fn(async () => { throw new TypeError('network'); }) as unknown as typeof fetch })).rejects.toMatchObject({ code: 'service_unavailable' });
});
it('makes no call when every text is empty', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  const f = reply([]);
  await assertTextAllowed(['', '  '], { fetchImpl: f as unknown as typeof fetch });
  expect(f).not.toHaveBeenCalled();
});

it('fails closed on malformed or incomplete moderation results', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  await expect(assertTextAllowed(['hello'], { fetchImpl: reply([]) as unknown as typeof fetch })).rejects.toMatchObject({ code: 'service_unavailable' });
  const malformed = async () => new Response(JSON.stringify({ results: [{ flagged: 'false' }] }));
  await expect(assertTextAllowed(['hello'], { fetchImpl: malformed })).rejects.toMatchObject({ code: 'service_unavailable' });
});
