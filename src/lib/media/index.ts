import { LIMITS, MEDIA_TYPES, type MediaKind } from '../contracts';
import { getConfig } from '../config';
import { ApiError } from '../errors';
import { sniffMedia } from './sniff';

export interface MediaStore {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(path: string): Promise<Uint8Array | null>;
  remove(paths: string[]): Promise<void>;
}
export function assertSafeMediaPath(path: string): void {
  if (!path || path.startsWith('/') || path.includes('..') || !/^[a-z0-9/_.-]+$/.test(path)) throw new Error('Invalid media path');
}
let testStore: MediaStore | null = null;
let cached: { signature: string; store: MediaStore } | undefined;
export function setMediaStoreForTests(store: MediaStore | null): void { testStore = store; }
export function getMediaStore(): MediaStore {
  if (testStore) return testStore;
  const config = getConfig();
  const signature = [config.mediaDriver, config.mediaDir, config.supabaseUrl, config.supabaseSecretKey, config.mediaBucket].join('|');
  if (cached?.signature === signature) return cached.store;
  let pending: Promise<MediaStore> | undefined;
  const load = () => pending ??= config.mediaDriver === 'supabase'
    ? import('./supabase').then(module => module.createSupabaseMediaStore(config.supabaseUrl!, config.supabaseSecretKey!, config.mediaBucket))
    : import('./local').then(module => module.createLocalMediaStore(config.mediaDir));
  const store: MediaStore = {
    put: async (path, bytes, contentType) => { assertSafeMediaPath(path); await (await load()).put(path, bytes, contentType); },
    get: async path => { assertSafeMediaPath(path); return (await load()).get(path); },
    remove: async paths => { paths.forEach(assertSafeMediaPath); await (await load()).remove(paths); },
  };
  cached = { signature, store };
  return store;
}
export function createMemoryMediaStore(): MediaStore & { paths(): string[] } {
  const data = new Map<string, Uint8Array>();
  return {
    async put(path, bytes) { assertSafeMediaPath(path); data.set(path, bytes.slice()); },
    async get(path) { assertSafeMediaPath(path); return data.get(path)?.slice() ?? null; },
    async remove(paths) { paths.forEach(assertSafeMediaPath); paths.forEach(path => data.delete(path)); },
    paths: () => [...data.keys()].sort(),
  };
}
export async function validatePeerMedia(file: File | null, kind: unknown, durationMs: unknown): Promise<{
  bytes: Uint8Array; mime: string; ext: 'webm' | 'mp4' | 'ogg' | 'wav'; kind: MediaKind; durationMs: number;
}> {
  if (!(file instanceof File) || (kind !== 'audio' && kind !== 'video')) throw new ApiError('invalid_input');
  const duration = typeof durationMs === 'string' && /^\d+$/.test(durationMs) ? Number(durationMs) : durationMs;
  if (typeof duration !== 'number' || !Number.isSafeInteger(duration) || duration < LIMITS.recorder.minMs || duration > LIMITS.peerMedia.maxMs) throw new ApiError('invalid_input');
  if (file.size > LIMITS.peerMedia.maxBytes) throw new ApiError('audio_too_large');
  const mime = file.type.split(';')[0].trim().toLowerCase();
  const media = MEDIA_TYPES[mime];
  if (!media || media.kind !== kind) throw new ApiError('media_invalid');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (sniffMedia(bytes) !== media.ext) throw new ApiError('media_invalid');
  const { inspectPeerMedia } = await import('./inspect');
  return { bytes, mime, ext: media.ext, kind, durationMs: await inspectPeerMedia(bytes, kind) };
}
