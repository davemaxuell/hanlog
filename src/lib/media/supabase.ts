import { createClient } from '@supabase/supabase-js';
import { ApiError } from '../errors';
import { assertSafeMediaPath, type MediaStore } from './index';

export function createSupabaseMediaStore(url: string, secretKey: string, bucket: string): MediaStore {
  const storage = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(bucket);
  const missing = (error: unknown) => {
    const value = error as { status?: number; statusCode?: string | number; code?: string };
    return value.status === 404 || String(value.statusCode) === '404' || value.code === 'NoSuchKey' || value.code === 'NotFound';
  };
  return {
    async put(path, bytes, contentType) {
      assertSafeMediaPath(path);
      const { error } = await storage.upload(path, bytes, { contentType, upsert: true });
      if (error) throw new ApiError('service_unavailable');
    },
    async get(path) {
      assertSafeMediaPath(path);
      const { data, error } = await storage.download(path);
      if (error) { if (missing(error)) return null; throw new ApiError('service_unavailable'); }
      return new Uint8Array(await data.arrayBuffer());
    },
    async remove(paths) {
      paths.forEach(assertSafeMediaPath);
      if (!paths.length) return;
      const { error } = await storage.remove(paths);
      if (error && !missing(error)) throw new ApiError('service_unavailable');
    },
  };
}
