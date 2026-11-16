import { ApiError } from '@/lib/errors';
import { route } from '@/lib/http';
import { getMediaStore } from '@/lib/media';
import { getPostImagePath } from '@/lib/repo/posts';
import { requireUser } from '@/lib/session';
export const runtime = 'nodejs';
export const GET = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const path = await getPostImagePath((await ctx.params).id, user.id);
  const bytes = path ? await getMediaStore().get(path) : null;
  if (!bytes) throw new ApiError('not_found');
  // Short private caching keeps a busy feed quick; hidden or deleted photos stop loading within minutes.
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
});
