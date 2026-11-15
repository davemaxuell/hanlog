import { readJson, route } from '@/lib/http';
import { ReportInputSchema } from '@/lib/community-contracts';
import { reportCommunityTarget } from '@/lib/repo/community';
import { requireSessionIdentity } from '@/lib/session';

export const runtime = 'nodejs';
export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { user, version } = await requireSessionIdentity(req);
  // Accept the original empty-body client while recording an explicit fallback reason.
  const { reason } = req.body ? await readJson(req, ReportInputSchema) : { reason: 'other' as const };
  await reportCommunityTarget(user, { responseId: (await ctx.params).id, reason, expectedVersion: version });
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } });
});
