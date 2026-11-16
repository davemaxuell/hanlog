import { json, readJson, route } from '@/lib/http';
import { setPostLike } from '@/lib/repo/posts';
import { requireUser } from '@/lib/session';
import { LikeInputSchema } from '@/lib/social-contracts';
export const runtime = 'nodejs';
export const PUT = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { liked } = await readJson(req, LikeInputSchema);
  return json(await setPostLike((await ctx.params).id, user, liked));
});
