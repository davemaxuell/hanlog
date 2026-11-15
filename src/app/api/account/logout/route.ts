import { route } from '@/lib/http';
import { revokeSessions } from '@/lib/repo/accounts';
import { clearSessionCookieHeader, requireSessionIdentity } from '@/lib/session';
export const runtime = 'nodejs';
export const POST = route(async req => {
  const { user, version } = await requireSessionIdentity(req);
  await revokeSessions(user.id, version);
  return new Response(null, { status: 204, headers: { 'Set-Cookie': clearSessionCookieHeader(), 'Cache-Control': 'private, no-store' } });
});
