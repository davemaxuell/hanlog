import { getRewards } from '@/lib/content';
import { json, route } from '@/lib/http';
export const runtime = 'nodejs';
export const GET = route(async () => json({ rewards: getRewards() }));
