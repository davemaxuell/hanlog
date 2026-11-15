import { ApiError } from '@/lib/errors';
import { route } from '@/lib/http';
import { canView, flagResponse, getResponseRecord } from '@/lib/repo/responses';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const record = await getResponseRecord((await ctx.params).id);
  if (!record) throw new ApiError('not_found');
  if (!canView(record, user)) throw new ApiError('forbidden');
  await flagResponse(record.id);
  return new Response(null, { status: 204 });
});
