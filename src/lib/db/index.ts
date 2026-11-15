import { getConfig } from '../config';
import { applyMigrations } from './migrate';
import { ensureSeed } from '../repo/seed';
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}
type DbGlobal = typeof globalThis & { __hanlogDb?: Promise<Db>; __hanlogTestDb?: Db };
const shared = globalThis as DbGlobal;
export function setDbForTests(db: Db | null): void { if (db) shared.__hanlogTestDb = db; else delete shared.__hanlogTestDb; }
export function getDb(): Promise<Db> {
  if (shared.__hanlogTestDb) return Promise.resolve(shared.__hanlogTestDb);
  shared.__hanlogDb ??= (async () => {
    const config = getConfig();
    if (config.dbDriver === 'pg') {
      const { createPgDb } = await import('./pg');
      return createPgDb(config.databaseUrl!);
    }
    const { createPgliteDb } = await import('./pglite');
    const db = await createPgliteDb(config.pgliteDir ?? (process.env.NODE_ENV === 'development' ? '.data/pglite' : undefined));
    await applyMigrations(db);
    await ensureSeed(db);
    return db;
  })().catch(error => { delete shared.__hanlogDb; throw error; });
  return shared.__hanlogDb;
}
export async function createTestDb(): Promise<Db & { close(): Promise<void> }> {
  const { createPgliteDb } = await import('./pglite');
  const db = await createPgliteDb();
  try { await applyMigrations(db); await ensureSeed(db); return db; } catch (error) { await db.close(); throw error; }
}
