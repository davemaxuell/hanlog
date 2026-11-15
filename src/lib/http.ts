import { createHash } from 'node:crypto';
import { API_ERROR_STATUS, type ApiErrorCode } from './contracts';
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
  if (!origin) {
    if (req.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError('forbidden');
    return;
  }
  try {
    const url = new URL(origin);
    const requestUrl = new URL(req.url);
    const expected = new URL(`${requestUrl.protocol}//${req.headers.get('host') ?? requestUrl.host}`).origin;
    if (origin !== url.origin || url.origin !== expected || !['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch { throw new ApiError('forbidden'); }
}
export function route<C = unknown>(handler: (req: Request, ctx: C) => Promise<Response>): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => { try { assertSameOrigin(req); return await handler(req, ctx); } catch (e) { return errorResponse(e); } };
}
export async function readJson<T>(req: Request, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }): Promise<T> {
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(await readBody(req, 16_384, 'invalid_input'))); } catch { throw new ApiError('invalid_input'); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError('invalid_input');
  return parsed.data;
}
async function readBody(req: Request, maxBytes: number, errorCode: ApiErrorCode): Promise<Uint8Array<ArrayBuffer>> {
  const length = req.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    await req.body?.cancel().catch(() => {});
    throw new ApiError(errorCode);
  }
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new ApiError(errorCode);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}
export async function readFormData(req: Request, maxFileBytes: number): Promise<FormData> {
  // Bounded envelope for field values, multipart headers and delimiters, below Vercel's body limit.
  const bytes = await readBody(req, maxFileBytes + 65_536, 'audio_too_large');
  try { return await new Response(bytes, { headers: { 'content-type': req.headers.get('content-type') ?? '' } }).formData(); }
  catch { throw new ApiError('invalid_input'); }
}
export function clientIpHash(req: Request): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return ip ? createHash('sha256').update(ip + getConfig().sessionSecret).digest('hex').slice(0, 32) : 'unknown';
}
export function kstDateString(now = new Date()): string { return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); }
export function kstDayStartIso(now = new Date()): string { return new Date(`${kstDateString(now)}T00:00:00+09:00`).toISOString(); }
