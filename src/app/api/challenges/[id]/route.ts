import { ApiError } from '@/lib/errors';
import { json, route } from '@/lib/http';
import { getChallengeRecord, toChallenge } from '@/lib/repo/challenges';
import { canView, getMyResponse, getResponseRecord, listResponsePage, publicResponse } from '@/lib/repo/responses';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const GET = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const record = await getChallengeRecord((await ctx.params).id, user.id);
  if (!record) throw new ApiError('not_found');
  const myResponse = await getMyResponse(record.id, user.id);
  const viewerRole = record.authorId === user.id ? 'author' : myResponse ? 'responder' : record.isSample && user.role === 'korean' ? 'rater' : 'visitor';
  const page = viewerRole === 'author' || viewerRole === 'rater' ? await listResponsePage(record.id, { limit: 20 }) : { responses: [], nextCursor: null };
  // Inbox links can target an older exchange beyond page one. Keep it bounded to
  // one additional response and apply the same private recording audience.
  const responseId = new URL(req.url).searchParams.get('response');
  if (responseId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(responseId)) throw new ApiError('invalid_input');
    const target = await getResponseRecord(responseId);
    if (!target || target.challengeId !== record.id || target.flagged || !canView(target, user)) throw new ApiError('not_found');
    if ((viewerRole === 'author' || viewerRole === 'rater') && !page.responses.some(response => response.id === target.id)) page.responses.push(publicResponse(target));
  }
  return json({ challenge: await toChallenge(record, user), viewerRole, myResponse, responses: page.responses, responsesNextCursor: page.nextCursor });
});
