import { ReportInputSchema } from '@/lib/community-contracts';
import { readJson, route } from '@/lib/http';
import { reportCommunityTarget } from '@/lib/repo/community';
import { requireUser } from '@/lib/session';
export const runtime = 'nodejs';
export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req); const { reason } = await readJson(req, ReportInputSchema);
  await reportCommunityTarget(user, { challengeId: (await ctx.params).id, reason });
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } });
});
