import { ApiError } from '@/lib/errors';
import { route } from '@/lib/http';
import { getMediaStore } from '@/lib/media';
import { getChallengeRecord, mediaWithinRetention } from '@/lib/repo/challenges';
import { requireUser } from '@/lib/session';
export const runtime = 'nodejs';
export const GET = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser(req);
  const record = await getChallengeRecord((await ctx.params).id);
  if (!record?.referencePath || !record.referenceMime || !mediaWithinRetention(record.createdAt)) throw new ApiError('not_found');
  const bytes = await getMediaStore().get(record.referencePath);
  if (!bytes) throw new ApiError('not_found');
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': record.referenceMime,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
});
