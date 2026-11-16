import { ApiError } from '@/lib/errors';
import { json, route } from '@/lib/http';
import { getLeaderboard } from '@/lib/repo/leaderboard';
import { requireUser } from '@/lib/session';
import { LeaderboardPeriodSchema } from '@/lib/social-contracts';
export const runtime = 'nodejs';
export const GET = route(async req => {
  const user = await requireUser(req);
  const period = LeaderboardPeriodSchema.safeParse(new URL(req.url).searchParams.get('period') ?? 'today');
  if (!period.success) throw new ApiError('invalid_input');
  return json(await getLeaderboard(user.id, period.data));
});
