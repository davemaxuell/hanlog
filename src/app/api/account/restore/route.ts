import { RestoreAccountInputSchema } from '@/lib/account-contracts';
import { clientIpHash, json, readJson, route } from '@/lib/http';
import { restoreAccountWithLimit } from '@/lib/repo/accounts';
import { sessionCookieHeader, signSession } from '@/lib/session';
export const runtime = 'nodejs';
export const POST = route(async req => {
  const { recoveryKey: key, requestId } = await readJson(req, RestoreAccountInputSchema);
  const { user, recoveryKey, version } = await restoreAccountWithLimit(key, requestId, clientIpHash(req));
  return json({ user, recoveryKey }, { headers: { 'Set-Cookie': sessionCookieHeader(await signSession(user.id, version)) } });
});
