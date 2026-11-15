export type Config = {
  isProd: boolean; sessionSecret: string;
  dbDriver: 'pglite' | 'pg'; databaseUrl: string | null; pgliteDir: string | null;
  mediaDriver: 'local' | 'supabase'; mediaDir: string; supabaseUrl: string | null; supabaseSecretKey: string | null; mediaBucket: string;
  scoringProvider: 'mock' | 'openai'; openaiApiKey: string | null; scoringModel: string;
  moderation: 'openai' | 'rules';
  limits: { userDailyAttempts: number; ipDailyAttempts: number; globalDailyAttempts: number; ipDailySessions: number };
  retentionDays: number; cronSecret: string | null;
};
export function getConfig(env: Record<string, string | undefined> = process.env): Config {
  const value = (key: string): string | null => env[key]?.trim() || null;
  const isProd = env.NODE_ENV === 'production';
  const sessionSecret = value('SESSION_SECRET') ?? (isProd ? '' : 'hanlog-development-only-secret-32-characters');
  if (sessionSecret.length < 32) throw new Error('SESSION_SECRET must have at least 32 characters');
  const cronSecret = value('CRON_SECRET');
  if (isProd && !cronSecret) throw new Error('CRON_SECRET is required in production');
  const databaseUrl = value('DATABASE_URL') ?? value('POSTGRES_URL');
  const supabaseUrl = value('SUPABASE_URL');
  const supabaseSecretKey = value('SUPABASE_SECRET_KEY') ?? value('SUPABASE_SERVICE_ROLE_KEY');
  if (env.VERCEL === '1') {
    if (!databaseUrl) throw new Error('DATABASE_URL or POSTGRES_URL is required on Vercel');
    if (!supabaseUrl) throw new Error('SUPABASE_URL is required on Vercel');
    if (!supabaseSecretKey) throw new Error('SUPABASE_SECRET_KEY is required on Vercel');
  }
  const openaiApiKey = value('OPENAI_API_KEY');
  const provider = value('SCORING_PROVIDER') ?? (openaiApiKey ? 'openai' : 'mock');
  if (provider !== 'openai' && provider !== 'mock') throw new Error('SCORING_PROVIDER must be openai or mock');
  if (provider === 'openai' && !openaiApiKey) throw new Error('OPENAI_API_KEY is required for openai scoring');
  const numeric = (key: string, fallback: number) => {
    const raw = value(key);
    if (!raw) return fallback;
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n) || n <= 0) throw new Error(`${key} must be a positive integer`);
    return n;
  };
  return {
    isProd, sessionSecret, cronSecret, databaseUrl, dbDriver: databaseUrl ? 'pg' : 'pglite', pgliteDir: value('PGLITE_DIR'),
    supabaseUrl, supabaseSecretKey, mediaDriver: supabaseUrl && supabaseSecretKey ? 'supabase' : 'local',
    mediaDir: value('MEDIA_DIR') ?? '.data/media', mediaBucket: value('MEDIA_BUCKET') ?? 'recordings',
    openaiApiKey, scoringProvider: provider, scoringModel: value('OPENAI_SCORING_MODEL') ?? 'gpt-audio-1.5', moderation: openaiApiKey ? 'openai' : 'rules',
    limits: { userDailyAttempts: numeric('USER_DAILY_ATTEMPTS', 30), ipDailyAttempts: numeric('IP_DAILY_ATTEMPTS', 600), globalDailyAttempts: numeric('GLOBAL_DAILY_ATTEMPTS', 1500), ipDailySessions: numeric('IP_DAILY_SESSIONS', 200) },
    retentionDays: numeric('RETENTION_DAYS', 14),
  };
}
