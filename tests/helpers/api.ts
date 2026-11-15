import { beforeEach, afterEach } from 'vitest';
import { createTestDb, setDbForTests } from '@/lib/db';
import { createUser } from '@/lib/repo/users';
import { SESSION_COOKIE, signSession } from '@/lib/session';
import type { Role, User } from '@/lib/contracts';
export function useTestDb(): void {
  let db: Awaited<ReturnType<typeof createTestDb>> | undefined;
  beforeEach(async () => { db = await createTestDb(); setDbForTests(db); });
  afterEach(async () => { setDbForTests(null); await db?.close(); });
}
export async function createTestUser(role: Role = 'learner', nickname = 'Aisha'): Promise<{ user: User; cookie: string }> {
  const user = await createUser({ role, nickname, ipHash: 'test' });
  return { user, cookie: `${SESSION_COOKIE}=${await signSession(user.id)}` };
}
export function makeRequest(method: string, path: string, opts: { cookie?: string; json?: unknown; form?: FormData; headers?: Record<string, string> } = {}): Request {
  const headers = new Headers({ host: 'localhost:3000', ...opts.headers });
  if (opts.cookie) headers.set('cookie', opts.cookie);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !headers.has('origin')) headers.set('origin', 'http://localhost:3000');
  let body: BodyInit | undefined = opts.form;
  if (opts.json !== undefined) { headers.set('content-type', 'application/json'); body = JSON.stringify(opts.json); }
  return new Request(new URL(path, 'http://localhost:3000'), { method, headers, body });
}
export function wavFile(bytes: Uint8Array, name = 'recording.wav'): File { return new File([new Uint8Array(bytes)], name, { type: 'audio/wav' }); }
