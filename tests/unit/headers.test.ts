import { expect, it } from 'vitest';
import config from '../../next.config';

it('sets the four required headers on every route', async () => {
  const rules = await config.headers?.();
  expect(rules).toContainEqual({ source: '/:path*', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'microphone=(self), camera=(self), geolocation=()' },
  ] });
});
