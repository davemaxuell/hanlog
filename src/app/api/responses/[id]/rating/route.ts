import { RatingInputSchema } from '@/lib/contracts';
import { ApiError } from '@/lib/errors';
import { json, readJson, route } from '@/lib/http';
import { assertTextAllowed } from '@/lib/moderation';
import { canRate, getResponseRecord, rateResponse } from '@/lib/repo/responses';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const record = await getResponseRecord((await ctx.params).id);
  if (!record || record.flagged) throw new ApiError('not_found');
  if (!canRate(record, user)) throw new ApiError('forbidden');
  const input = await readJson(req, RatingInputSchema);
  await assertTextAllowed([input.comment]);
  return json({ response: await rateResponse({ responseId: record.id, raterId: user.id, ...input }) });
});
