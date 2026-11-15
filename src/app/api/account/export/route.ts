import { route } from '@/lib/http';
import { createAccountExport } from '@/lib/repo/accounts';
import { requireUser } from '@/lib/session';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const GET = route(async req => new Response(await createAccountExport(await requireUser(req)), { headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store',
  'Content-Disposition': `attachment; filename="hanlog-data-${new Date().toISOString().slice(0, 10)}.json"`,
} }));
