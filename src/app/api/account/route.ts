import { json, route } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { accountStatus } from '@/lib/repo/accounts';
export const runtime = 'nodejs';
export const GET = route(async req => json(await accountStatus((await requireUser(req)).id)));
