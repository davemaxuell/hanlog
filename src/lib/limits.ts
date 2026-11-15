import { getDb } from './db';
import { getConfig } from './config';
import { ApiError } from './errors';
import { kstDayStartIso } from './http';
import { lockSessionUser } from './repo/users';
export type Reservation = { id: string; leftToday: number };
export async function reserveScoringCall(input: { userId: string; ipHash: string; now?: Date; expectedVersion?: number }): Promise<Reservation> {
  const now = input.now ?? new Date();
  const since = kstDayStartIso(now);
  const until = new Date(new Date(since).getTime() + 86400000).toISOString();
  const limits = getConfig().limits;
  return (await getDb()).tx(async db => {
    await db.query("select pg_advisory_xact_lock(hashtext('scoring_calls'))");
    if (input.expectedVersion !== undefined) await lockSessionUser(db, input.userId, input.expectedVersion);
    const [counts] = await db.query<{ total: number; user_count: number; ip_count: number }>(`
      select count(*)::int as total, count(*) filter (where user_id = $1)::int as user_count,
      count(*) filter (where ip_hash = $2)::int as ip_count from hanlog.scoring_calls where created_at >= $3 and created_at < $4`, [input.userId, input.ipHash, since, until]);
    if (counts.total >= limits.globalDailyAttempts) throw new ApiError('budget_exhausted');
    if (input.ipHash !== 'unknown' && counts.ip_count >= limits.ipDailyAttempts) throw new ApiError('daily_limit');
    if (counts.user_count >= limits.userDailyAttempts) throw new ApiError('daily_limit');
    const [row] = await db.query<{ id: string }>('insert into hanlog.scoring_calls (user_id, ip_hash, created_at) values ($1, $2, $3) returning id::text', [input.userId, input.ipHash, now.toISOString()]);
    return { id: row.id, leftToday: limits.userDailyAttempts - counts.user_count - 1 };
  });
}
export async function finishScoringCall(id: string, outcome: 'scored' | 'no_speech' | 'failed'): Promise<void> {
  await (await getDb()).query("update hanlog.scoring_calls set outcome = $2 where id = $1 and outcome = 'pending'", [id, outcome]);
}
