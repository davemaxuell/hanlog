import { getDb, type Db } from '../db';
import { SYSTEM_USER_ID, type Role } from '../contracts';
import { kstDayStartIso } from '../http';
import type { Leaderboard, LeaderboardPeriod, RankedPerson } from '../social-contracts';

type RankRow = { rank: number; id: string; nickname: string; role: Role; points: number; practised: number; average_score: number | null };
export const LEADERBOARD_SIZE = 50;

/**
 * Ranks people by points in a period. Leaderboards list visible people with points;
 * groups list every member, because joining a group is agreeing to compare within it.
 */
export async function rankPeople(db: Db, options: { period: LeaderboardPeriod; viewerId: string; groupId?: string; limit?: number }): Promise<RankedPerson[]> {
  const since = options.period === 'today' ? kstDayStartIso() : null;
  const rows = await db.query<RankRow>(`
    with people as (
      select u.id, u.nickname, u.role from hanlog.users u
      where u.id <> $1 and (
        ($3::uuid is null and u.show_on_leaderboard)
        or ($3::uuid is not null and exists(select 1 from hanlog.group_members m where m.group_id = $3 and m.user_id = u.id)))
    ), totals as (
      select p.id, coalesce(sum(e.delta), 0)::int as points from people p
      left join hanlog.point_events e on e.user_id = p.id and ($2::timestamptz is null or e.created_at >= $2)
      group by p.id
    ), best as (
      select a.user_id, a.mission_id, max(a.overall) as best from hanlog.attempts a
      where a.user_id in (select id from people) group by a.user_id, a.mission_id
    ), skill as (
      select user_id, count(*)::int as practised, round(avg(best))::int as average_score from best group by user_id
    )
    select rank() over (order by t.points desc)::int as rank, p.id, p.nickname, p.role, t.points,
      coalesce(s.practised, 0)::int as practised, s.average_score
    from people p join totals t on t.id = p.id left join skill s on s.user_id = p.id
    where $3::uuid is not null or t.points > 0
    order by t.points desc, p.nickname, p.id
    limit $4`, [SYSTEM_USER_ID, since, options.groupId ?? null, options.limit ?? LEADERBOARD_SIZE]);
  return rows.map(row => ({
    rank: row.rank, userId: row.id, nickname: row.nickname, role: row.role, points: row.points,
    practised: row.practised, averageScore: row.average_score, isMe: row.id === options.viewerId,
  }));
}

export async function getLeaderboard(viewerId: string, period: LeaderboardPeriod): Promise<Leaderboard> {
  const db = await getDb();
  const entries = await rankPeople(db, { period, viewerId });
  const since = period === 'today' ? kstDayStartIso() : null;
  const [me] = await db.query<{ visible: boolean; points: number }>(`select u.show_on_leaderboard as visible,
    coalesce((select sum(delta) from hanlog.point_events e where e.user_id = u.id and ($2::timestamptz is null or e.created_at >= $2)), 0)::int as points
    from hanlog.users u where u.id = $1`, [viewerId, since]);
  let rank: number | null = entries.find(entry => entry.isMe)?.rank ?? null;
  if (rank === null && me?.visible && me.points > 0) {
    // Outside the top list: rank is one more than the visible people with more points.
    const [above] = await db.query<{ count: number }>(`select count(*)::int as count from (
      select e.user_id from hanlog.point_events e join hanlog.users u on u.id = e.user_id
      where u.show_on_leaderboard and u.id <> $3 and ($2::timestamptz is null or e.created_at >= $2)
      group by e.user_id having sum(e.delta) > $1) higher`, [me.points, since, SYSTEM_USER_ID]);
    rank = above.count + 1;
  }
  return { period, entries, me: { rank, points: me?.points ?? 0, visible: me?.visible ?? false } };
}

export async function setLeaderboardVisibility(userId: string, visible: boolean): Promise<void> {
  await (await getDb()).query('update hanlog.users set show_on_leaderboard = $2 where id = $1', [userId, visible]);
}
