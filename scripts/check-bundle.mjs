import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const filesUnder = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(entry => entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)]))).flat();
const forbidden = ['api.openai.com', 'chat/completions', 'OPENAI_API_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'SESSION_SECRET', 'CRON_SECRET', 'pg_advisory'];
const keyPattern = /sk-[A-Za-z0-9_-]{20,}/;
const failures = [];
for (const file of await filesUnder('.next/static')) {
  const source = await readFile(file, 'utf8');
  if (forbidden.some(value => source.includes(value)) || keyPattern.test(source)) failures.push(`Client bundle contains a server-only value: ${file}`);
}
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
for (const file of tracked) {
  if (file === '.env.local' || file.startsWith('.data/')) failures.push(`Private local file tracked: ${file}`);
  if (keyPattern.test(await readFile(file, 'utf8'))) failures.push(`Credential-shaped value in tracked file: ${file}`);
}
// Report only filenames, never matched credential text.
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('bundle clean, repository clean');
