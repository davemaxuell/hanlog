import { getDb, type Db } from '../db';
import type { PointReason, PointsSummary, PointEvent } from '../contracts';
export async function addPointEvent(db: Db, e: { userId: string; delta: number; reason: PointReason; refId: string; label: string }): Promise<void> {
  if (!e.delta) return;
  await db.query('insert into hanlog.point_events (user_id, delta, reason, ref_id, label) values ($1, $2, $3, $4, $5)', [e.userId, e.delta, e.reason, e.refId, e.label]);
}
export async function getBalance(db: Db, userId: string): Promise<number> {
  return (await db.query<{ balance: number }>('select coalesce(sum(delta), 0)::int as balance from hanlog.point_events where user_id = $1', [userId]))[0].balance;
}
export async function getPoints(userId: string): Promise<PointsSummary> {
  const db = await getDb();
  const rows = await db.query<{ id: string; delta: number; reason: PointReason; label: string; created_at: Date | string }>('select id, delta, reason, label, created_at from hanlog.point_events where user_id = $1 order by created_at desc, id desc limit 50', [userId]);
  const events: PointEvent[] = rows.map(r => ({ id: r.id, delta: r.delta, reason: r.reason, label: r.label, createdAt: new Date(r.created_at).toISOString() }));
  return { balance: await getBalance(db, userId), events };
}
