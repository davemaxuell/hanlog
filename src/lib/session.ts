import { SignJWT, jwtVerify } from 'jose';
import { getConfig } from './config';
import { getUser } from './repo/users';
import { ApiError } from './errors';
import type { User } from './contracts';
export const SESSION_COOKIE = 'hl_session';
const maxAge = 90 * 24 * 60 * 60;
const key = () => new TextEncoder().encode(getConfig().sessionSecret);
export async function signSession(userId: string): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('90d').sign(key());
}
export async function verifySession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'], maxTokenAge: '90d' });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch { return null; }
}
export async function getSessionUser(req: Request): Promise<User | null> {
  const cookie = req.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return null;
  const id = await verifySession(cookie.slice(SESSION_COOKIE.length + 1));
  return id ? getUser(id) : null;
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
