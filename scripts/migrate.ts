import { createPgDb } from '../src/lib/db/pg';
import { applyMigrations } from '../src/lib/db/migrate';
import { ensureSeed } from '../src/lib/repo/seed';

const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
if (!url) {
  console.error('DATABASE_URL or POSTGRES_URL is required to run migrations.');
  process.exitCode = 1;
} else {
  const db = createPgDb(url);
  try {
    const applied = await applyMigrations(db);
    await ensureSeed(db);
    console.log(applied.length ? applied.join('\n') : 'No pending migrations.');
  } catch {
    // Driver errors can include connection details. Never print them or the URL.
    console.error('Database migration failed. Check the server connection and migration SQL.');
    process.exitCode = 1;
  } finally { await db.close(); }
}
