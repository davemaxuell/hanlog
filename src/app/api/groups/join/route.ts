import { json, readJson, route } from '@/lib/http';
import { joinGroup } from '@/lib/repo/groups';
import { requireUser } from '@/lib/session';
import { JoinGroupInputSchema } from '@/lib/social-contracts';
export const runtime = 'nodejs';
export const POST = route(async req => {
  const user = await requireUser(req);
  const { code } = await readJson(req, JoinGroupInputSchema);
  return json({ group: await joinGroup(user, code) });
});
