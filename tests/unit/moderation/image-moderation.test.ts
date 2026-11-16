import { afterEach, expect, it, vi } from 'vitest';
import { assertImageAllowed } from '@/lib/moderation';

afterEach(() => vi.unstubAllEnvs());
const reply = (flags: boolean[], status = 200) => vi.fn(async () => new Response(JSON.stringify({ results: flags.map(flagged => ({ flagged })) }), { status }));
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

it('rejects links in a photo caption without calling anyone, and passes offline without a key', async () => {
  const f = reply([true]);
  await expect(assertImageAllowed(jpeg, ['카페', 'see www.spam.example'], { fetchImpl: f as unknown as typeof fetch })).rejects.toMatchObject({ code: 'content_rejected' });
  await expect(assertImageAllowed(jpeg, ['카페'], { fetchImpl: f as unknown as typeof fetch })).resolves.toBeUndefined();
  expect(f).not.toHaveBeenCalled();
});

it('checks the photo and its words together when a key is configured', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  const clean = reply([false]);
  await assertImageAllowed(jpeg, ['아이스 아메리카노', '', 'Campus café'], { fetchImpl: clean as unknown as typeof fetch });
  const [, init] = clean.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(init.body as string)).toEqual({ model: 'omni-moderation-latest', input: [
    { type: 'text', text: '아이스 아메리카노' }, { type: 'text', text: 'Campus café' },
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/2Q==' } },
  ] });
  await expect(assertImageAllowed(jpeg, ['카페'], { fetchImpl: reply([true]) as unknown as typeof fetch })).rejects.toMatchObject({ code: 'content_rejected' });
  await expect(assertImageAllowed(jpeg, ['카페'], { fetchImpl: reply([], 500) as unknown as typeof fetch })).rejects.toMatchObject({ code: 'service_unavailable' });
});
