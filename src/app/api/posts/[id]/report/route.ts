import { ReportInputSchema } from '@/lib/community-contracts';
import { readJson, route } from '@/lib/http';
import { reportPost } from '@/lib/repo/posts';
import { requireUser } from '@/lib/session';
export const runtime = 'nodejs';
export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { reason } = await readJson(req, ReportInputSchema);
  await reportPost((await ctx.params).id, user, reason);
  return new Response(null, { status: 204 });
});
