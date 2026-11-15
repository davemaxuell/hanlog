import { route } from '@/lib/http';
import { setSavedMission } from '@/lib/repo/progress';
import { requireUser } from '@/lib/session';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
const change = (saved: boolean) => route(async (req, ctx: Context) => {
  await setSavedMission((await requireUser(req)).id, (await ctx.params).id, saved);
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } });
});
export const PUT = change(true);
export const DELETE = change(false);
