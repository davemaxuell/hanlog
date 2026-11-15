import { SignJWT, jwtVerify } from 'jose';
import { getConfig } from './config';
import { getUserSession } from './repo/users';
import { ApiError } from './errors';
import type { User } from './contracts';
export const SESSION_COOKIE = 'hl_session';
const maxAge = 90 * 24 * 60 * 60;
const key = () => new TextEncoder().encode(getConfig().sessionSecret);
export async function signSession(userId: string, version = 0): Promise<string> {
  return new SignJWT({ v: version }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('90d').sign(key());
}
async function verifyClaims(token: string): Promise<{ id: string; version: number } | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'], maxTokenAge: '90d' });
    const version = payload.v === undefined ? 0 : payload.v;
    return typeof payload.sub === 'string' && typeof version === 'number' && Number.isSafeInteger(version) && version >= 0 ? { id: payload.sub, version } : null;
  } catch { return null; }
}
export async function verifySession(token: string): Promise<string | null> { return (await verifyClaims(token))?.id ?? null; }
export async function getSessionIdentity(req: Request): Promise<{ user: User; version: number } | null> {
  const cookie = req.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return null;
  const claims = await verifyClaims(cookie.slice(SESSION_COOKIE.length + 1));
  if (!claims) return null;
  const session = await getUserSession(claims.id);
  return session?.version === claims.version ? session : null;
}
export async function getSessionUser(req: Request): Promise<User | null> { return (await getSessionIdentity(req))?.user ?? null; }
export async function requireSessionIdentity(req: Request): Promise<{ user: User; version: number }> {
  const session = await getSessionIdentity(req);
  if (!session) throw new ApiError('unauthenticated');
  return session;
}
export async function requireUser(req: Request): Promise<User> {
  const user = await getSessionUser(req);
  if (!user) throw new ApiError('unauthenticated');
  return user;
}
export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${getConfig().isProd ? '; Secure' : ''}`;
}
export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${getConfig().isProd ? '; Secure' : ''}`;
}
