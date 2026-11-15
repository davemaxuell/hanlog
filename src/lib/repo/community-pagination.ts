import { z } from 'zod';
import { ApiError } from '../errors';
// ISO permits year 0000, while PostgreSQL timestamptz rejects it.
const CursorSchema = z.object({ at: z.iso.datetime().refine(value => !value.startsWith('0000-')), id: z.uuid() });
export type CommunityCursor = z.infer<typeof CursorSchema>;
export function encodeCommunityCursor(at: Date | string, id: string): string { return Buffer.from(JSON.stringify({ at: typeof at === 'string' ? at : at.toISOString(), id })).toString('base64url'); }
export function decodeCommunityCursor(value?: string | null): CommunityCursor | null {
  if (!value) return null;
  try {
    if (value.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error();
    return CursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
  } catch { throw new ApiError('invalid_input'); }
}
export function communityPageInput(url: URL, defaultLimit = 20): { cursor: CommunityCursor | null; limit: number } {
  const raw = url.searchParams.get('limit');
  const limit = raw === null ? defaultLimit : Number(raw);
  if ((raw !== null && !/^\d+$/.test(raw)) || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new ApiError('invalid_input');
  return { cursor: decodeCommunityCursor(url.searchParams.get('cursor')), limit };
}
