import { afterEach, beforeEach, expect, it } from 'vitest';
import { createTestDb, getDb, setDbForTests, type Db } from '@/lib/db';
import { applyMigrations } from '@/lib/db/migrate';

let db: Db & { close(): Promise<void> };
beforeEach(async () => { db = await createTestDb(); });
afterEach(async () => { setDbForTests(null); await db.close(); });

it('creates every table in schema hanlog with row level security on', async () => {
  const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
    `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'hanlog' and c.relkind = 'r' order by c.relname`);
  expect(rows.map((r) => r.relname)).toEqual(['attempts', 'challenge_responses', 'challenges', 'community_reports', 'group_join_failures', 'group_members', 'groups', 'pending_media_deletions', 'point_events', 'post_likes', 'post_reports', 'posts', 'recovery_attempt_limits', 'saved_missions', 'schema_migrations', 'scoring_calls', 'session_creation_limits', 'users']);
  expect(rows.filter((r) => r.relname !== 'schema_migrations').every((r) => r.relrowsecurity)).toBe(true);
});
it('is idempotent', async () => {
  expect(await applyMigrations(db)).toEqual([]);
});
it('backfills the active creation quota when upgrading an existing database', async () => {
  await db.query("insert into hanlog.users(nickname,role,ip_hash) values ('First','learner','upgrade-cap'),('Second','learner','upgrade-cap')");
  await db.query("insert into hanlog.users(nickname,role,ip_hash,created_at) values ('Old','learner','old-cap',now() - interval '2 days')");
  await db.query('drop table hanlog.session_creation_limits');
  await db.query("delete from hanlog.schema_migrations where name = '007_session_creation_limits.sql'");
  expect(await applyMigrations(db)).toEqual(['007_session_creation_limits.sql']);
  expect(await db.query("select ip_hash,sessions from hanlog.session_creation_limits where ip_hash in ('upgrade-cap','old-cap')")).toEqual([{ ip_hash: 'upgrade-cap', sessions: 2 }]);
  await db.query("delete from hanlog.users where ip_hash = 'upgrade-cap'");
  expect(await db.query("select sessions from hanlog.session_creation_limits where ip_hash = 'upgrade-cap'")).toEqual([{ sessions: 2 }]);
});
it('rolls back a failed transaction', async () => {
  await expect(db.tx(async (t) => {
    await t.query(`insert into hanlog.users (nickname, role, ip_hash) values ($1, 'learner', 'x')`, ['a']);
    throw new Error('boom');
  })).rejects.toThrow('boom');
  expect((await db.query<{ n: number }>(`select count(*)::int as n from hanlog.users where nickname = 'a'`))[0].n).toBe(0);
});
it('joins nested transactions', async () => {
  await expect(db.tx(async (outer) => {
    await outer.tx(async (inner) => { await inner.query(`insert into hanlog.users (nickname, role, ip_hash) values ('b', 'korean', 'x')`); });
    throw new Error('outer fails');
  })).rejects.toThrow('outer fails');
  expect((await db.query<{ n: number }>(`select count(*)::int as n from hanlog.users where nickname = 'b'`))[0].n).toBe(0);
});
it('enforces checks', async () => {
  await expect(db.query(`insert into hanlog.users (nickname, role, ip_hash) values ('c', 'admin', 'x')`)).rejects.toThrow();
});
it('getDb returns the test database while set, and one shared instance otherwise', async () => {
  setDbForTests(db);
  expect(await getDb()).toBe(db);
  setDbForTests(null);
  const [a, b] = await Promise.all([getDb(), getDb()]);
  expect(a).toBe(b);
});
