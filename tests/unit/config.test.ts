import { expect, it } from 'vitest';
import { getConfig } from '@/lib/config';

const secret = 'x'.repeat(32);

it('defaults to local everything', () => {
  const c = getConfig({});
  expect(c).toMatchObject({
    isProd: false, dbDriver: 'pglite', databaseUrl: null, pgliteDir: null,
    mediaDriver: 'local', mediaDir: '.data/media', mediaBucket: 'recordings',
    scoringProvider: 'mock', scoringModel: 'gpt-audio-1.5', moderation: 'rules',
    retentionDays: 14, cronSecret: null,
  });
  expect(c.limits).toEqual({ userDailyAttempts: 30, ipDailyAttempts: 600, globalDailyAttempts: 1500, ipDailySessions: 200 });
  expect(c.sessionSecret.length).toBeGreaterThanOrEqual(32);
});
it('fails fast in production without secrets', () => {
  expect(() => getConfig({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
  expect(() => getConfig({ NODE_ENV: 'production', SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
  expect(() => getConfig({ NODE_ENV: 'production', SESSION_SECRET: secret })).toThrow(/CRON_SECRET/);
  expect(getConfig({ NODE_ENV: 'production', SESSION_SECRET: secret, CRON_SECRET: 'c', PGLITE_DIR: '.data/demo-db' }).isProd).toBe(true);
});
it('selects drivers from the environment', () => {
  expect(getConfig({ DATABASE_URL: 'postgres://a' }).dbDriver).toBe('pg');
  expect(getConfig({ POSTGRES_URL: 'postgres://b' }).databaseUrl).toBe('postgres://b');
  expect(getConfig({ SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }).mediaDriver).toBe('supabase');
  expect(getConfig({ SUPABASE_URL: 'u' }).mediaDriver).toBe('local');
  expect(getConfig({ OPENAI_API_KEY: 'k' })).toMatchObject({ scoringProvider: 'openai', moderation: 'openai' });
  expect(getConfig({ OPENAI_API_KEY: 'k', SCORING_PROVIDER: 'mock' }).scoringProvider).toBe('mock');
  expect(() => getConfig({ SCORING_PROVIDER: 'openai' })).toThrow(/OPENAI_API_KEY/);
});
it('refuses to run on Vercel with stores that would lose data', () => {
  const base = { VERCEL: '1', NODE_ENV: 'production', SESSION_SECRET: secret, CRON_SECRET: 'c' };
  expect(() => getConfig(base)).toThrow(/DATABASE_URL/);
  expect(() => getConfig({ ...base, DATABASE_URL: 'postgres://a' })).toThrow(/SUPABASE_URL/);
  expect(() => getConfig({ ...base, DATABASE_URL: 'postgres://a', SUPABASE_URL: 'u' })).toThrow(/SUPABASE_SECRET_KEY/);
  expect(getConfig({ ...base, DATABASE_URL: 'postgres://a', SUPABASE_URL: 'u', SUPABASE_SECRET_KEY: 'k' })).toMatchObject({ dbDriver: 'pg', mediaDriver: 'supabase' });
});
it('reads numeric overrides and rejects nonsense', () => {
  expect(getConfig({ USER_DAILY_ATTEMPTS: '5', RETENTION_DAYS: '7' })).toMatchObject({ limits: { userDailyAttempts: 5 }, retentionDays: 7 });
  expect(() => getConfig({ USER_DAILY_ATTEMPTS: 'many' })).toThrow(/USER_DAILY_ATTEMPTS/);
});
it('can isolate local test recordings from the demo folder', () => {
  expect(getConfig({ MEDIA_DIR: '.data/e2e-media' }).mediaDir).toBe('.data/e2e-media');
});
it('refuses an ephemeral production database and partial production storage credentials', () => {
  const base = { NODE_ENV: 'production', SESSION_SECRET: secret, CRON_SECRET: 'c' };
  expect(() => getConfig(base)).toThrow(/PGLITE_DIR|DATABASE_URL/);
  expect(() => getConfig({ ...base, PGLITE_DIR: '.data/demo-db', SUPABASE_URL: 'https://storage.example' })).toThrow(/SUPABASE/);
  expect(() => getConfig({ ...base, PGLITE_DIR: '.data/demo-db', SUPABASE_SECRET_KEY: 'test' })).toThrow(/SUPABASE/);
  expect(getConfig({ ...base, DATABASE_URL: 'postgres://a' }).dbDriver).toBe('pg');
  expect(getConfig({ ...base, PGLITE_DIR: 'memory://' }).pgliteDir).toBe('memory://');
});
