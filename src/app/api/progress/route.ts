import { json, route } from '@/lib/http';
import { getProgressSummary } from '@/lib/repo/progress';
import { requireUser } from '@/lib/session';
export const runtime = 'nodejs';
export const GET = route(async req => json(await getProgressSummary((await requireUser(req)).id)));
