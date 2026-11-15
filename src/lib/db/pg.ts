import pg from 'pg';
import { checkServerIdentity } from 'node:tls';
import type { Db } from './index';
export function createPgDb(connectionString: string): Db & { close(): Promise<void> } {
  const options: pg.PoolConfig = { connectionString, max: 5 };
  const ca = process.env.DATABASE_CA_CERT?.trim().replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  if (ca) {
    let url: URL;
    try { url = new URL(connectionString); }
    catch { throw new Error('A valid Postgres URL is required when DATABASE_CA_CERT is set'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('A valid Postgres URL is required when DATABASE_CA_CERT is set');
    const negotiation = url.searchParams.get('sslnegotiation');
    if (negotiation !== null && negotiation !== 'postgres' && negotiation !== 'direct') throw new Error('sslnegotiation must be postgres or direct');
    if (negotiation) options.sslnegotiation = negotiation;
    // pg merges URL options after explicit options. Remove all URL TLS switches,
    // including direct negotiation's implicit ssl=true, so none can discard the CA.
    for (const name of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat', 'sslnegotiation']) url.searchParams.delete(name);
    options.connectionString = url.toString();
    options.ssl = { ca, rejectUnauthorized: true, checkServerIdentity };
  }
  const pool = new pg.Pool(options);
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
