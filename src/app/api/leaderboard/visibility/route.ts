import { json, readJson, route } from '@/lib/http';
import { setLeaderboardVisibility } from '@/lib/repo/leaderboard';
import { requireUser } from '@/lib/session';
import { LeaderboardVisibilityInputSchema } from '@/lib/social-contracts';
export const runtime = 'nodejs';
export const PUT = route(async req => {
  const user = await requireUser(req);
  const { visible } = await readJson(req, LeaderboardVisibilityInputSchema);
  await setLeaderboardVisibility(user.id, visible);
  return json({ visible });
});
