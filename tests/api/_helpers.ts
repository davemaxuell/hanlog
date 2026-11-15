export function call(handler: (req: Request, ctx: never) => Promise<Response>, req: Request, params?: Record<string, string>): Promise<Response> {
  return handler(req, { params: Promise.resolve(params ?? {}) } as never);
}
export function cookieFrom(res: Response): string { return res.headers.get('set-cookie')?.split(';')[0] ?? ''; }
import { afterEach, beforeEach } from 'vitest';
import { createMemoryMediaStore, setMediaStoreForTests } from '@/lib/media';
export function webmBytes(size = 2000): Uint8Array { const bytes = new Uint8Array(size); bytes.set([0x1a, 0x45, 0xdf, 0xa3]); return bytes; }
export function mp4Bytes(size = 2000): Uint8Array { const bytes = new Uint8Array(size); bytes.set(new TextEncoder().encode('ftyp'), 4); return bytes; }
export function mediaFile(bytes: Uint8Array, type: string): File { return new File([new Uint8Array(bytes)], 'recording', { type }); }
export function useMemoryMedia(): { paths(): string[] } {
  let store = createMemoryMediaStore();
  beforeEach(() => { store = createMemoryMediaStore(); setMediaStoreForTests(store); });
  afterEach(() => setMediaStoreForTests(null));
  return { paths: () => store.paths() };
}
