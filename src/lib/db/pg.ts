import pg from 'pg';
import type { Db } from './index';
export function createPgDb(connectionString: string): Db & { close(): Promise<void> } {
  const pool = new pg.Pool({ connectionString, max: 5 });
  const rows = <T>(result: pg.QueryResult | pg.QueryResult[]): T[] => (Array.isArray(result) ? result.flatMap(r => r.rows) : result.rows) as T[];
  return {
    query: async <T>(text: string, params?: unknown[]) => rows<T>(await pool.query(text, params)),
    tx: async <T>(fn: (db: Db) => Promise<T>) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const joined: Db = { query: async <R>(text: string, params?: unknown[]) => rows<R>(await client.query(text, params)), tx: fn => fn(joined) };
        const value = await fn(joined);
        await client.query('COMMIT');
        return value;
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    close: () => pool.end(),
  };
}
