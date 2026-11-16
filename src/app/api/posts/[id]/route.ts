import { route } from '@/lib/http';
import { deletePost } from '@/lib/repo/posts';
import { requireUser } from '@/lib/session';
export const runtime = 'nodejs';
export const DELETE = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  await deletePost((await ctx.params).id, await requireUser(req));
  return new Response(null, { status: 204 });
});
