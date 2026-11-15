import { ApiError } from '@/lib/errors';
import { route } from '@/lib/http';
import { getMediaStore } from '@/lib/media';
import { canView, getResponseRecord } from '@/lib/repo/responses';
import { requireUser } from '@/lib/session';
export const runtime = 'nodejs';
export const GET = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const record = await getResponseRecord((await ctx.params).id, user.id);
  if (!record?.mediaPath || !record.mediaAvailable || record.flagged) throw new ApiError('not_found');
  if (!canView(record, user)) throw new ApiError('forbidden');
  const bytes = await getMediaStore().get(record.mediaPath);
  if (!bytes) throw new ApiError('not_found');
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': record.mediaMime,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
});
