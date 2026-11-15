import { createHash, timingSafeEqual } from 'node:crypto';
import { getConfig } from '@/lib/config';
import { ApiError } from '@/lib/errors';
import { json, route } from '@/lib/http';
import { cleanupExpiredMedia } from '@/lib/media/cleanup';
export const runtime = 'nodejs';
export const GET = route(async req => {
  const secret = getConfig().cronSecret;
  if (!secret) throw new ApiError('unauthenticated');
  const supplied = createHash('sha256').update(req.headers.get('authorization') ?? '').digest();
  const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
  if (!timingSafeEqual(supplied, expected)) throw new ApiError('unauthenticated');
  return json({ deleted: await cleanupExpiredMedia() });
});
