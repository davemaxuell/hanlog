import { json, route } from '@/lib/http';
import { getPoints } from '@/lib/repo/points';
import { requireUser } from '@/lib/session';
export const runtime = 'nodejs';
export const GET = route(async req => json(await getPoints((await requireUser(req)).id)));
