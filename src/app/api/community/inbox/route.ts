import { json, route } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { communityInbox } from '@/lib/repo/community';
import { communityPageInput } from '@/lib/repo/community-pagination';
export const runtime = 'nodejs';
export const GET = route(async req => {
  const user = await requireUser(req);
  return json(await communityInbox(user.id, communityPageInput(new URL(req.url))));
});
