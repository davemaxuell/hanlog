import { describe, expect, it } from 'vitest';
import { siteUrl, isPreview } from '@/lib/site';

describe('public site metadata', () => {
  it('keeps the local demo self-contained', () => {
    expect(siteUrl({}).href).toBe('http://localhost:3000/');
    expect(isPreview({})).toBe(false);
  });
  it('uses the deployment host for previews even when a production site is configured', () => {
    const env = { VERCEL_ENV: 'preview', VERCEL_URL: 'hanlog-abc.vercel.app', SITE_URL: 'https://hanlog.example' };
    expect(siteUrl(env).href).toBe('https://hanlog-abc.vercel.app/');
    expect(isPreview(env)).toBe(true);
  });
  it('uses an explicit production origin and falls back to Vercel system hosts', () => {
    expect(siteUrl({ SITE_URL: 'https://hanlog.example/' }).href).toBe('https://hanlog.example/');
    expect(siteUrl({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'hanlog.vercel.app', VERCEL_URL: 'hanlog-abc.vercel.app' }).href).toBe('https://hanlog.vercel.app/');
    expect(siteUrl({ VERCEL_URL: 'hanlog-abc.vercel.app' }).href).toBe('https://hanlog-abc.vercel.app/');
  });
  it.each(['not a url', 'ftp://example.com', 'https://user:secret@example.com', 'https://example.com/extra', 'https://example.com/?token=secret', 'https://example.com/#fragment'])('rejects malformed origins without echoing their contents', (value) => {
    expect(() => siteUrl({ SITE_URL: value })).toThrow('SITE_URL must be an http(s) origin without credentials, a path, query, or fragment.');
  });
});
