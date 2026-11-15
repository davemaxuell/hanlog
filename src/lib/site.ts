type SiteEnvironment = Readonly<Record<string, string | undefined>>;

export function isPreview(env: SiteEnvironment = process.env): boolean {
  return env.VERCEL_ENV === 'preview';
}

function origin(value: string, setting: string): URL {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    return url;
  } catch {
    // Environment values can contain credentials; never repeat them in diagnostics.
    throw new Error(`${setting} must be an http(s) origin without credentials, a path, query, or fragment.`);
  }
}

export function siteUrl(env: SiteEnvironment = process.env): URL {
  if (isPreview(env) && env.VERCEL_URL) return origin(`https://${env.VERCEL_URL}`, 'VERCEL_URL');
  if (env.SITE_URL) return origin(env.SITE_URL, 'SITE_URL');
  if (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL) return origin(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`, 'VERCEL_PROJECT_PRODUCTION_URL');
  if (env.VERCEL_URL) return origin(`https://${env.VERCEL_URL}`, 'VERCEL_URL');
  return new URL('http://localhost:3000');
}
