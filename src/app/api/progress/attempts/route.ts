import { json, route } from '@/lib/http';
import { ApiError } from '@/lib/errors';
import { getAttemptHistory } from '@/lib/repo/progress';
import { requireUser } from '@/lib/session';
export const runtime = 'nodejs';
export const GET = route(async req => {
  const user = await requireUser(req); const query = new URL(req.url).searchParams;
  const rawLimit = query.get('limit');
  if (rawLimit !== null && !/^\d{1,2}$/.test(rawLimit)) throw new ApiError('invalid_input');
  return json(await getAttemptHistory(user.id, { cursor: query.get('cursor') ?? undefined, missionId: query.get('missionId') ?? undefined, limit: rawLimit === null ? undefined : Number(rawLimit) }));
});
