import { createHash } from 'node:crypto';
import { API_ERROR_STATUS } from './contracts';
import { getConfig } from './config';
import { ApiError } from './errors';
export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'private, no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}
export function errorResponse(e: unknown): Response {
  const error = e instanceof ApiError ? e : new ApiError('internal');
  return json({ error: { code: error.code, message: error.message } }, { status: API_ERROR_STATUS[error.code] });
}
export function assertSameOrigin(req: Request): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  if (!origin) return;
  try {
    const url = new URL(origin);
    if (url.host !== (req.headers.get('host') ?? new URL(req.url).host) || !['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch { throw new ApiError('forbidden'); }
}
export function route<C = unknown>(handler: (req: Request, ctx: C) => Promise<Response>): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => { try { assertSameOrigin(req); return await handler(req, ctx); } catch (e) { return errorResponse(e); } };
}
export async function readJson<T>(req: Request, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }): Promise<T> {
  let value: unknown;
  try { value = await req.json(); } catch { throw new ApiError('invalid_input'); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError('invalid_input');
  return parsed.data;
}
export function clientIpHash(req: Request): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return ip ? createHash('sha256').update(ip + getConfig().sessionSecret).digest('hex').slice(0, 32) : 'unknown';
}
export function kstDateString(now = new Date()): string { return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); }
export function kstDayStartIso(now = new Date()): string { return new Date(`${kstDateString(now)}T00:00:00+09:00`).toISOString(); }
