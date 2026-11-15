import { getDb } from '../db';
import type { Attempt, Mission, Score } from '../contracts';
import { POINT_LABELS, missionAward } from '../points/rules';
import { addPointEvent, getBalance } from './points';
export async function recordAttempt(input: { userId: string; mission: Mission; score: Score }): Promise<{ attempt: Attempt; balance: number; bestOverall: number }> {
  return (await getDb()).tx(async db => {
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [input.userId]);
    const [prior] = await db.query<{ earned: number; best: number }>('select coalesce(sum(points_awarded), 0)::int as earned, coalesce(max(overall), 0)::int as best from hanlog.attempts where user_id = $1 and mission_id = $2', [input.userId, input.mission.id]);
    const award = Math.max(0, missionAward(input.mission.basePoints, input.score.overall) - prior.earned);
    const score = input.score;
    const [row] = await db.query<{ id: string; created_at: Date | string }>(`
      insert into hanlog.attempts (user_id, mission_id, overall, pronunciation, accuracy, usage, heard, feedback, scored_by, points_awarded)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id, created_at`,
      [input.userId, input.mission.id, score.overall, score.pronunciation, score.accuracy, score.usage, score.heard, JSON.stringify({ issues: score.issues, praise: score.praise, nextTip: score.nextTip }), score.scoredBy, award]);
    await addPointEvent(db, { userId: input.userId, delta: award, reason: 'mission', refId: row.id, label: POINT_LABELS.mission(input.mission.korean) });
    return { attempt: { id: row.id, missionId: input.mission.id, score, pointsAwarded: award, createdAt: new Date(row.created_at).toISOString() }, balance: await getBalance(db, input.userId), bestOverall: Math.max(score.overall, prior.best) };
  });
}
export async function missionProgress(userId: string): Promise<Record<string, { bestOverall: number; pointsEarned: number }>> {
  const rows = await (await getDb()).query<{ mission_id: string; best: number; earned: number }>('select mission_id, max(overall)::int as best, sum(points_awarded)::int as earned from hanlog.attempts where user_id = $1 group by mission_id', [userId]);
  return Object.fromEntries(rows.map(row => [row.mission_id, { bestOverall: row.best, pointsEarned: row.earned }]));
}
