import { json, readJson, route } from '@/lib/http';
import { assertTextAllowed } from '@/lib/moderation';
import { createGroup, listMyGroups } from '@/lib/repo/groups';
import { requireUser } from '@/lib/session';
import { CreateGroupInputSchema } from '@/lib/social-contracts';
export const runtime = 'nodejs';
export const GET = route(async req => json({ groups: await listMyGroups((await requireUser(req)).id) }));
export const POST = route(async req => {
  const user = await requireUser(req);
  const { name } = await readJson(req, CreateGroupInputSchema);
  await assertTextAllowed([name]);
  return json({ group: await createGroup(user, name) }, { status: 201 });
});
