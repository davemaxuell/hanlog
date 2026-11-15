import { json, route } from '@/lib/http';
import { requireSessionIdentity, sessionCookieHeader, signSession } from '@/lib/session';
import { rotateRecoveryKey } from '@/lib/repo/accounts';
export const runtime = 'nodejs';
export const POST = route(async req => {
  const session = await requireSessionIdentity(req);
  const { user, recoveryKey, version } = await rotateRecoveryKey(session.user.id, session.version);
  return json({ user, recoveryKey }, { headers: { 'Set-Cookie': sessionCookieHeader(await signSession(user.id, version)) } });
});
