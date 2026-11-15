import { FeedbackInputSchema } from '@/lib/contracts';
import { ApiError } from '@/lib/errors';
import { json, readJson, route } from '@/lib/http';
import { assertTextAllowed } from '@/lib/moderation';
import { getResponseRecord, giveFeedback } from '@/lib/repo/responses';
import { requireSessionIdentity } from '@/lib/session';

export const runtime = 'nodejs';
export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { user, version } = await requireSessionIdentity(req);
  const record = await getResponseRecord((await ctx.params).id, user.id);
  if (!record || record.flagged) throw new ApiError('not_found');
  if (record.responder.id !== user.id) throw new ApiError('forbidden');
  const input = await readJson(req, FeedbackInputSchema);
  await assertTextAllowed([input.comment]);
  return json({ response: await giveFeedback({ responseId: record.id, responderId: user.id, ...input, expectedVersion: version }) });
});
