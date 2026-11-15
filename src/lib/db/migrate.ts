import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Db } from './index';
export async function applyMigrations(db: Db, dir = 'db/migrations'): Promise<string[]> {
  await db.query('create schema if not exists hanlog; create table if not exists hanlog.schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const applied: string[] = [];
  // next.config explicitly includes migration SQL; dynamic test directories must not trace the whole repo.
  for (const name of (await readdir(/* turbopackIgnore: true */ dir)).filter(name => name.endsWith('.sql')).sort()) {
    await db.tx(async tx => {
      await tx.query("select pg_advisory_xact_lock(hashtext('hanlog_migrations'))");
      if ((await tx.query('select name from hanlog.schema_migrations where name = $1', [name])).length) return;
      const file = join(/* turbopackIgnore: true */ dir, name);
      await tx.query(await readFile(/* turbopackIgnore: true */ file, 'utf8'));
      await tx.query('insert into hanlog.schema_migrations (name) values ($1)', [name]);
      applied.push(name);
    });
  }
  return applied;
}
