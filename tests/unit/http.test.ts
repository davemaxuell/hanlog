import { expect, it } from 'vitest';
import { ApiError } from '@/lib/errors';
import { assertSameOrigin, clientIpHash, errorResponse, json, kstDateString, kstDayStartIso, readJson, route } from '@/lib/http';
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
