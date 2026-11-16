import { ApiError } from '@/lib/errors';
import { json, route } from '@/lib/http';
import { getGroupDetail, leaveGroup } from '@/lib/repo/groups';
import { requireUser } from '@/lib/session';
import { LeaderboardPeriodSchema } from '@/lib/social-contracts';
export const runtime = 'nodejs';
export const GET = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const period = LeaderboardPeriodSchema.safeParse(new URL(req.url).searchParams.get('period') ?? 'all');
  if (!period.success) throw new ApiError('invalid_input');
  return json(await getGroupDetail((await ctx.params).id, user.id, period.data));
});
export const DELETE = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  await leaveGroup((await ctx.params).id, await requireUser(req));
  return new Response(null, { status: 204 });
});
