import { expect, it } from 'vitest';
import { ApiError } from '@/lib/errors';
import { assertSameOrigin, clientIpHash, errorResponse, json, kstDateString, kstDayStartIso, readFormData, readJson, route } from '@/lib/http';
import { RatingInputSchema } from '@/lib/contracts';

const post = (headers: Record<string, string>, body?: string) =>
  new Request('https://hanlog.test/api/x', { method: 'POST', headers: { host: 'hanlog.test', ...headers }, body });

it('maps ApiError to status and body', async () => {
  const res = errorResponse(new ApiError('daily_limit'));
  expect(res.status).toBe(429);
  expect((await res.json()).error.code).toBe('daily_limit');
});
it('hides unknown errors', async () => {
  const res = errorResponse(new Error('db password is hunter2'));
  expect(res.status).toBe(500);
  const body = await res.json();
  expect(body.error.code).toBe('internal');
  expect(JSON.stringify(body)).not.toContain('hunter2');
});
it('route() converts throws and checks origin on writes', async () => {
  const handler = route(async () => json({ ok: true }, { status: 201 }));
  expect((await handler(post({ origin: 'https://hanlog.test' }), {})).status).toBe(201);
  expect((await handler(post({ origin: 'https://evil.test' }), {})).status).toBe(403);
  expect((await handler(post({}), {})).status).toBe(201); // no Origin header: allowed
  const failing = route(async () => { throw new ApiError('not_found'); });
  expect((await failing(new Request('https://hanlog.test/api/x'), {})).status).toBe(404);
});
it('assertSameOrigin ignores GET', () => {
  expect(() => assertSameOrigin(new Request('https://hanlog.test/api/x', { headers: { origin: 'https://evil.test', host: 'hanlog.test' } }))).not.toThrow();
});
it('rejects a wrong scheme, non-origin URLs, and cross-site writes without Origin', () => {
  for (const origin of ['http://hanlog.test', 'https://hanlog.test/path', 'https://a@hanlog.test', 'null']) {
    expect(() => assertSameOrigin(post({ origin }))).toThrow();
  }
  expect(() => assertSameOrigin(post({ 'sec-fetch-site': 'cross-site' }))).toThrow();
  expect(() => assertSameOrigin(post({ 'sec-fetch-site': 'same-origin' }))).not.toThrow();
});
it('bounds the full multipart body even without a Content-Length header', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(32_000)); },
    cancel() { cancelled = true; },
  });
  const req = new Request('https://hanlog.test/api/x', { method: 'POST', body: stream, duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=x' } } as RequestInit);
  await expect(readFormData(req, 1000)).rejects.toMatchObject({ code: 'audio_too_large' });
  expect(cancelled).toBe(true);
});
it('rejects oversized declarations before reading and does not trust a small declaration', async () => {
  const declared = post({ 'content-length': '9999999', 'content-type': 'multipart/form-data; boundary=x' });
  await expect(readFormData(declared, 1000)).rejects.toMatchObject({ code: 'audio_too_large' });
  const form = new FormData();
  form.set('audio', new File([new Uint8Array(80_000)], 'a.wav'));
  const encoded = new Request('https://hanlog.test/api/x', { method: 'POST', body: form });
  const req = new Request(encoded.url, { method: 'POST', headers: { 'content-length': '1', 'content-type': encoded.headers.get('content-type')! }, body: await encoded.arrayBuffer() });
  await expect(readFormData(req, 1000)).rejects.toMatchObject({ code: 'audio_too_large' });
});
it('parses a bounded valid multipart body and limits oversized JSON', async () => {
  const form = new FormData(); form.set('name', 'hello');
  expect((await readFormData(new Request('https://hanlog.test/api/x', { method: 'POST', body: form }), 1000)).get('name')).toBe('hello');
  await expect(readJson(post({ 'content-type': 'application/json' }, JSON.stringify({ comment: 'a'.repeat(20_000) })), RatingInputSchema)).rejects.toMatchObject({ code: 'invalid_input' });
});
it('readJson rejects bad bodies as invalid_input', async () => {
  await expect(readJson(post({ 'content-type': 'application/json' }, '{not json'), RatingInputSchema)).rejects.toMatchObject({ code: 'invalid_input' });
  await expect(readJson(post({ 'content-type': 'application/json' }, '{"pronunciation":9}'), RatingInputSchema)).rejects.toMatchObject({ code: 'invalid_input' });
});
it('hashes the client address', () => {
  const a = clientIpHash(new Request('https://h.test', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } }));
  const b = clientIpHash(new Request('https://h.test', { headers: { 'x-forwarded-for': '9.9.9.9' } }));
  expect(a).toMatch(/^[0-9a-f]{32}$/);
  expect(a).not.toBe(b);
  expect(a).not.toContain('1.2.3.4');
  expect(clientIpHash(new Request('https://h.test'))).toBe('unknown');
});
it('computes the Korea-time day', () => {
  expect(kstDayStartIso(new Date('2026-11-15T16:30:00Z'))).toBe('2026-11-15T15:00:00.000Z');
  expect(kstDayStartIso(new Date('2026-11-15T14:59:59Z'))).toBe('2026-11-14T15:00:00.000Z');
  expect(kstDateString(new Date('2026-11-15T16:30:00Z'))).toBe('2026-11-16');
});
