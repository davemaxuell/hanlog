import { getMissions, todaysMissionIds } from '@/lib/content';
import { json, kstDateString, route } from '@/lib/http';
import { missionProgress } from '@/lib/repo/attempts';
import { getSessionUser } from '@/lib/session';
export const runtime = 'nodejs';
export const GET = route(async req => {
  const user = await getSessionUser(req);
  const progress = user ? await missionProgress(user.id) : {};
  return json({ missions: getMissions().map(mission => ({ ...mission, ...(progress[mission.id] ?? { bestOverall: null, pointsEarned: 0 }) })), today: todaysMissionIds(kstDateString()) });
});
