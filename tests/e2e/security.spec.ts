import { expect, test } from '@playwright/test';

test('pages carry the security headers', async ({ request }) => {
  const headers = (await request.get('/')).headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['permissions-policy']).toBe('microphone=(self), camera=(self), geolocation=()');
});
test('the session cookie is locked down', async ({ request }) => {
  const res = await request.post('/api/session', { data: { nickname: 'Cookie', role: 'learner', consent: true } });
  const cookie = res.headers()['set-cookie'];
  for (const part of ['hl_session=', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(cookie).toContain(part);
});
test('a write from another origin is refused', async ({ request }) => {
  const res = await request.post('/api/session', { headers: { origin: 'https://evil.example' }, data: { nickname: 'Evil', role: 'learner', consent: true } });
  expect(res.status()).toBe(403);
});
