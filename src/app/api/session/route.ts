import { CreateSessionInputSchema, UpdateSessionInputSchema, type User } from '@/lib/contracts';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { clientIpHash, json, kstDayStartIso, readJson, route } from '@/lib/http';
import { assertTextAllowed } from '@/lib/moderation';
import { deleteUserCascade, updateUser } from '@/lib/repo/users';
import { clearSessionCookieHeader, getSessionUser, requireUser, sessionCookieHeader, signSession } from '@/lib/session';
import { getMediaStore } from '@/lib/media';
export const runtime = 'nodejs';
export const GET = route(async req => json({ user: await getSessionUser(req) }));
export const POST = route(async req => {
  const existing = await getSessionUser(req);
  if (existing) return json({ user: existing });
  const input = await readJson(req, CreateSessionInputSchema);
  await assertTextAllowed([input.nickname]);
  const ipHash = clientIpHash(req);
  // Count and creation share a transaction so simultaneous onboarding cannot exceed the cap.
  const user = await (await getDb()).tx(async db => {
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [`sessions:${ipHash}`]);
    if (ipHash !== 'unknown') {
      const [row] = await db.query<{ n: number }>('select count(*)::int as n from hanlog.users where ip_hash = $1 and created_at >= $2', [ipHash, kstDayStartIso()]);
      if (row.n >= getConfig().limits.ipDailySessions) throw new ApiError('daily_limit');
    }
    const [row] = await db.query<{ id: string; nickname: string; role: User['role']; created_at: Date | string }>('insert into hanlog.users (nickname, role, ip_hash) values ($1, $2, $3) returning id, nickname, role, created_at', [input.nickname, input.role, ipHash]);
    return { id: row.id, nickname: row.nickname, role: row.role, createdAt: new Date(row.created_at).toISOString() };
  });
  return json({ user }, { status: 201, headers: { 'Set-Cookie': sessionCookieHeader(await signSession(user.id)) } });
});
export const PATCH = route(async req => {
  const user = await requireUser(req);
  const patch = await readJson(req, UpdateSessionInputSchema);
  if (patch.nickname !== undefined) await assertTextAllowed([patch.nickname]);
  return json({ user: await updateUser(user.id, patch) });
});
export const DELETE = route(async req => {
  const user = await requireUser(req);
  const paths = await deleteUserCascade(user.id);
  try { await getMediaStore().remove(paths); }
  catch { console.error('Media cleanup required after profile deletion', { paths }); }
  return new Response(null, { status: 204, headers: { 'Set-Cookie': clearSessionCookieHeader() } });
});
