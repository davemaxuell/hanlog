export function call(handler: (req: Request, ctx: never) => Promise<Response>, req: Request, params?: Record<string, string>): Promise<Response> {
  return handler(req, { params: Promise.resolve(params ?? {}) } as never);
}
export function cookieFrom(res: Response): string { return res.headers.get('set-cookie')?.split(';')[0] ?? ''; }
import { afterEach, beforeEach } from 'vitest';
import { createMemoryMediaStore, setMediaStoreForTests } from '@/lib/media';
import { GET as challengeList, POST as createChallenge } from '@/app/api/challenges/route';
import { GET as challengeDetail } from '@/app/api/challenges/[id]/route';
import { POST as createAnswer } from '@/app/api/challenges/[id]/responses/route';
import type { Challenge, ChallengeDetail } from '@/lib/contracts';
import { makeRequest } from '../helpers/api';
export function webmBytes(size = 2000): Uint8Array { const bytes = new Uint8Array(size); bytes.set([0x1a, 0x45, 0xdf, 0xa3]); return bytes; }
export function mp4Bytes(size = 2000): Uint8Array { const bytes = new Uint8Array(size); bytes.set(new TextEncoder().encode('ftyp'), 4); return bytes; }
export function mediaFile(bytes: Uint8Array, type: string): File { return new File([new Uint8Array(bytes)], 'recording', { type }); }
export function useMemoryMedia(): { paths(): string[] } {
  let store = createMemoryMediaStore();
  beforeEach(() => { store = createMemoryMediaStore(); setMediaStoreForTests(store); });
  afterEach(() => setMediaStoreForTests(null));
  return { paths: () => store.paths() };
}
export async function postChallenge(cookie: string, extra: Record<string, string | File> = {}): Promise<Challenge> {
  const form = new FormData();
  for (const [key, value] of Object.entries({ korean: '이거 완전 꿀잼이야.', meaningEn: 'Really fun.', situationEn: '', ...extra })) form.set(key, value);
  const result = await call(createChallenge, makeRequest('POST', '/api/challenges', { cookie, form }));
  if (result.status !== 201) throw new Error(`Challenge fixture failed: ${result.status}`);
  return (await result.json()).challenge;
}
export function postAnswer(cookie: string | undefined, challengeId: string, file = mediaFile(webmBytes(), 'audio/webm'), kind = 'audio'): Promise<Response> {
  const form = new FormData();
  form.set('media', file); form.set('kind', kind); form.set('durationMs', '3000');
  return call(createAnswer, makeRequest('POST', `/api/challenges/${challengeId}/responses`, { cookie, form }), { id: challengeId });
}
export async function viewChallenge(cookie: string, id: string): Promise<ChallengeDetail> {
  return (await call(challengeDetail, makeRequest('GET', `/api/challenges/${id}`, { cookie }), { id })).json();
}
export async function listScope(cookie: string, scope: string): Promise<Challenge[]> {
  return (await (await call(challengeList, makeRequest('GET', `/api/challenges?scope=${scope}`, { cookie }))).json()).challenges;
}
