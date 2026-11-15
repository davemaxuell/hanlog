import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

await mkdir('.data', { recursive: true });
const secretFile = '.data/demo-session-secret';
try { await writeFile(secretFile, randomBytes(32).toString('hex'), { flag: 'wx' }); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
const sessionSecret = (await readFile(secretFile, 'utf8')).trim();
const cronSecret = randomBytes(32).toString('hex');
const port = process.env.PORT || '3000';
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('PORT must be between 1 and 65535');
const dev = process.argv.includes('--dev');
const child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), dev ? 'dev' : 'start', '--hostname', '127.0.0.1', '--port', port], {
  stdio: 'inherit', windowsHide: true,
  env: {
    ...process.env, NODE_ENV: dev ? 'development' : 'production', VERCEL: '',
    OPENAI_API_KEY: '', SCORING_PROVIDER: 'mock', SESSION_SECRET: sessionSecret, CRON_SECRET: cronSecret,
    DATABASE_URL: '', POSTGRES_URL: '', SUPABASE_URL: '', SUPABASE_SECRET_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '',
    PGLITE_DIR: '.data/demo-db', MEDIA_DIR: '.data/demo-media',
  },
});
console.log(`HanLog local demo: http://localhost:${port} (mock scoring; no paid API calls)`);
const cleanup = async () => {
  try { await fetch(`http://127.0.0.1:${port}/api/cron/cleanup`, { headers: { authorization: `Bearer ${cronSecret}` }, signal: AbortSignal.timeout(5000) }); }
  catch { /* Startup or shutdown: the next scheduled run can retry. */ }
};
const firstCleanup = setTimeout(cleanup, 3000);
const dailyCleanup = setInterval(cleanup, 60 * 60 * 1000);
child.on('exit', code => { clearTimeout(firstCleanup); clearInterval(dailyCleanup); process.exitCode = code ?? 1; });
child.on('error', () => { clearTimeout(firstCleanup); clearInterval(dailyCleanup); console.error('Could not start HanLog. Run npm ci and npm run build first.'); process.exitCode = 1; });
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
