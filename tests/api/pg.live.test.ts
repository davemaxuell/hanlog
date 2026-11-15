import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPgDb } from '@/lib/db/pg';
import { setDbForTests } from '@/lib/db';
import { applyMigrations } from '@/lib/db/migrate';
import { ensureSeed } from '@/lib/repo/seed';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('real Postgres', () => {
  let db: ReturnType<typeof createPgDb> | undefined;
  const users: string[] = [];
  beforeAll(async () => {
    vi.stubEnv('USER_DAILY_ATTEMPTS', '5');
    db = createPgDb(url!);
    await applyMigrations(db);
    await ensureSeed(db);
    setDbForTests(db);
  });
  afterAll(async () => {
    try {
      if (db && users.length) {
        await db.query('delete from hanlog.scoring_calls where user_id = any($1::uuid[])', [users]);
        await db.query('delete from hanlog.users where id = any($1::uuid[])', [users]);
      }
    } finally { setDbForTests(null); await db?.close(); vi.unstubAllEnvs(); }
  });

  it('pays a mission once under real concurrency', async () => {
    const { createUser } = await import('@/lib/repo/users');
    const { recordAttempt } = await import('@/lib/repo/attempts');
    const { getMission } = await import('@/lib/content');
    const user = await createUser({ nickname: 'pg-live', role: 'learner', ipHash: `live-${Date.now()}` });
    users.push(user.id);
    const score = { overall: 90, pronunciation: 90, accuracy: 90, usage: 90, heard: 'h', issues: [], praise: 'p', nextTip: 't', scoredBy: 'mock' as const };
    const results = await Promise.all(Array.from({ length: 8 }, () => recordAttempt({ userId: user.id, mission: getMission('campus-group-roles')!, score })));
    expect(results.reduce((sum, r) => sum + r.attempt.pointsAwarded, 0)).toBe(30);
  });
  it('never exceeds the cap under real concurrency', async () => {
    const { createUser } = await import('@/lib/repo/users');
    const { reserveScoringCall } = await import('@/lib/limits');
    const user = await createUser({ nickname: 'pg-live-2', role: 'learner', ipHash: `live2-${Date.now()}` });
    users.push(user.id);
    const settled = await Promise.allSettled(Array.from({ length: 12 }, () => reserveScoringCall({ userId: user.id, ipHash: 'unknown' })));
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(5);
  });
});
