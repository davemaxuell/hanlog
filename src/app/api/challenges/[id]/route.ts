import { ApiError } from '@/lib/errors';
import { json, route } from '@/lib/http';
import { getChallengeRecord, toChallenge } from '@/lib/repo/challenges';
import { getMyResponse, listResponses } from '@/lib/repo/responses';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const GET = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const record = await getChallengeRecord((await ctx.params).id);
  if (!record) throw new ApiError('not_found');
  const myResponse = await getMyResponse(record.id, user.id);
  const viewerRole = record.authorId === user.id ? 'author' : myResponse ? 'responder' : record.isSample && user.role === 'korean' ? 'rater' : 'visitor';
  const responses = viewerRole === 'author' || viewerRole === 'rater' ? await listResponses(record.id) : [];
  return json({ challenge: await toChallenge(record, user), viewerRole, myResponse, responses });
});
