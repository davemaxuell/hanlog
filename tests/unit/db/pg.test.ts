import { afterEach, expect, it, vi } from 'vitest';
import { checkServerIdentity, rootCertificates, type ConnectionOptions, type PeerCertificate } from 'node:tls';
import pg from 'pg';
import { createPgDb } from '@/lib/db/pg';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function capturePoolConfig(connectionString: string): Promise<pg.PoolConfig> {
  let config: pg.PoolConfig | undefined;
  vi.spyOn(pg, 'Pool').mockImplementation(class {
    constructor(options: pg.PoolConfig) { config = options; }
    async end() {}
  } as unknown as typeof pg.Pool);
  await createPgDb(connectionString).close();
  return config!;
}
function effectiveTls(config: pg.PoolConfig): ConnectionOptions {
  // Construction parses the real installed driver's URL options without opening a connection.
  const client = new pg.Client(config);
  return (client as unknown as { connectionParameters: { ssl: ConnectionOptions } }).connectionParameters.ssl;
}
it('uses the configured CA with strict certificate and hostname verification despite URL SSL settings', async () => {
  vi.stubEnv('DATABASE_CA_CERT', rootCertificates[0]);
  const config = await capturePoolConfig('postgres://user:fake@project.pooler.supabase.com:6543/postgres?sslmode=require&uselibpqcompat=true&application_name=hanlog');
  const tls = effectiveTls(config);
  expect(tls.ca).toBe(rootCertificates[0].trim());
  expect(tls.rejectUnauthorized).toBe(true);
  expect(tls.checkServerIdentity).toBe(checkServerIdentity);
  const cert = { subjectaltname: 'DNS:project.pooler.supabase.com' } as PeerCertificate;
  expect(tls.checkServerIdentity!('project.pooler.supabase.com', cert)).toBeUndefined();
  expect(tls.checkServerIdentity!('wrong.example', cert)).toBeInstanceOf(Error);
  expect(new URL(config.connectionString!).searchParams.get('application_name')).toBe('hanlog');
});
it('does not let other SSL URL switches discard the CA or weaken verification', async () => {
  vi.stubEnv('DATABASE_CA_CERT', rootCertificates[0]);
  const config = await capturePoolConfig('postgres://user:fake@project.pooler.supabase.com/postgres?ssl=false&sslmode=no-verify&sslrootcert=unused.pem&sslcert=unused.pem&sslkey=unused.pem&sslnegotiation=direct');
  const tls = effectiveTls(config);
  expect(tls).toMatchObject({ ca: rootCertificates[0].trim(), rejectUnauthorized: true, checkServerIdentity });
  expect(config.sslnegotiation).toBe('direct');
});
it('accepts escaped PEM newlines from environment transfer', async () => {
  vi.stubEnv('DATABASE_CA_CERT', rootCertificates[0].trim().replace(/\n/g, '\\n'));
  const config = await capturePoolConfig('postgres://user:fake@db.example/postgres?sslmode=verify-full');
  expect(effectiveTls(config).ca).toBe(rootCertificates[0].trim());
});
it('preserves existing pool options when the optional CA is unset', async () => {
  vi.stubEnv('DATABASE_CA_CERT', '');
  const connectionString = 'postgres://postgres@127.0.0.1:5432/local';
  expect(await capturePoolConfig(connectionString)).toEqual({ connectionString, max: 5 });
});
