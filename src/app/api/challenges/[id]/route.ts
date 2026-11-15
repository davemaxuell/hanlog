import { ApiError } from '@/lib/errors';
import { json, route } from '@/lib/http';
import { getChallengeRecord, toChallenge } from '@/lib/repo/challenges';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const GET = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const record = await getChallengeRecord((await ctx.params).id);
  if (!record) throw new ApiError('not_found');
  const viewerRole = record.authorId === user.id ? 'author' : record.isSample && user.role === 'korean' ? 'rater' : 'visitor';
  return json({ challenge: await toChallenge(record, user), viewerRole, myResponse: null, responses: [] });
});
