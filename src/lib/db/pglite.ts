import { PGlite } from '@electric-sql/pglite';
import type { Db } from './index';
type Executor = Pick<PGlite, 'query' | 'exec'>;
const queryWith = async <T>(client: Executor, text: string, params?: unknown[]): Promise<T[]> => {
  if (params?.length) return (await client.query<T>(text, params)).rows;
  return (await client.exec(text)).flatMap(result => result.rows) as T[];
};
export async function createPgliteDb(dir?: string): Promise<Db & { close(): Promise<void> }> {
  const client = dir && dir !== 'memory://' ? new PGlite(dir) : new PGlite();
  await client.waitReady;
  return {
    query: <T>(text: string, params?: unknown[]) => queryWith<T>(client, text, params),
    tx: <T>(fn: (db: Db) => Promise<T>) => client.transaction(async transaction => {
      const joined: Db = { query: <R>(text: string, params?: unknown[]) => queryWith<R>(transaction, text, params), tx: fn => fn(joined) };
      return fn(joined);
    }),
    close: () => client.close(),
  };
}
