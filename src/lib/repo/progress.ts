import { z } from 'zod';
import { getDb } from '../db';
import { getMission, getMissions } from '../content';
import { ApiError } from '../errors';
import { AttemptSchema, type Attempt } from '../contracts';
import { kstDateString } from '../http';
import type { AttemptHistory, ProgressSummary } from '../progress-contracts';
import { lockSessionUser } from './users';

type AttemptRow = { id: string; mission_id: string; overall: number; pronunciation: number; accuracy: number; usage: number; heard: string; feedback: { issues: unknown[]; praise: string; nextTip: string }; scored_by: string; points_awarded: number; created_at: Date | string; cursor_time?: string };
const attemptFields = 'id,mission_id,overall,pronunciation,accuracy,usage,heard,feedback,scored_by,points_awarded,created_at';
function toAttempt(row: AttemptRow): Attempt {
  return AttemptSchema.parse({ id: row.id, missionId: row.mission_id, score: { overall: row.overall, pronunciation: row.pronunciation, accuracy: row.accuracy, usage: row.usage, heard: row.heard, ...row.feedback, scoredBy: row.scored_by }, pointsAwarded: row.points_awarded, createdAt: new Date(row.created_at).toISOString() });
}
const CursorSchema = z.object({ t: z.iso.datetime(), id: z.uuid(), m: z.string().nullable() });
function cursorValue(cursor: string | undefined, missionId: string | undefined) {
  if (!cursor) return null;
  if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new ApiError('invalid_input');
  try {
    const value = CursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    if (value.m !== (missionId ?? null)) throw new Error();
    return value;
  } catch { throw new ApiError('invalid_input'); }
}

export async function getAttemptHistory(userId: string, options: { cursor?: string; missionId?: string; limit?: number } = {}): Promise<AttemptHistory> {
  const limit = options.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new ApiError('invalid_input');
  if (options.missionId && !getMission(options.missionId)) throw new ApiError('not_found');
  const cursor = cursorValue(options.cursor, options.missionId);
  const rows = await (await getDb()).query<AttemptRow>(`select ${attemptFields},to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_time from hanlog.attempts where user_id = $1
    and ($2::text is null or mission_id = $2) and ($3::timestamptz is null or (created_at,id) < ($3::timestamptz,$4::uuid))
    order by created_at desc,id desc limit $5`, [userId, options.missionId ?? null, cursor?.t ?? null, cursor?.id ?? null, limit + 1]);
  const attempts = rows.slice(0, limit).map(toAttempt);
  const last = rows[limit - 1];
  return { attempts, nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ t: last.cursor_time, id: last.id, m: options.missionId ?? null })).toString('base64url') : null };
}

export async function getProgressSummary(userId: string, now = new Date()): Promise<ProgressSummary> {
  const db = await getDb(); const today = kstDateString(now); const missions = getMissions();
  const days = Array.from({ length: 7 }, (_, i) => new Date(new Date(`${today}T00:00:00Z`).getTime() - (6 - i) * 86_400_000).toISOString().slice(0, 10));
  const since = new Date(`${days[0]}T00:00:00+09:00`).toISOString();
  const [totals, streaks, week, recent, prior, saved] = await Promise.all([
    db.query<{ total: number; practiced: number; strong: number; days: number; average: string | number | null }>(`select count(*)::int as total, count(distinct mission_id)::int as practiced,
      count(distinct mission_id) filter (where overall >= 80)::int as strong,
      count(distinct (created_at at time zone 'Asia/Seoul')::date)::int as days, round(avg(overall),1) as average
      from hanlog.attempts where user_id = $1 and created_at <= $2`, [userId, now.toISOString()]),
    db.query<{ current: number; longest: number }>(`with days as (
      select distinct (created_at at time zone 'Asia/Seoul')::date as day from hanlog.attempts where user_id = $1 and created_at <= $2
    ), islands as (select day, day - (row_number() over (order by day))::int as grp from days),
    runs as (select max(day) as last_day, count(*)::int as length from islands group by grp)
    select coalesce(max(length) filter (where last_day >= $3::date - 1),0)::int as current, coalesce(max(length),0)::int as longest from runs`, [userId, now.toISOString(), today]),
    db.query<{ day: string; attempts: number }>(`select to_char(created_at at time zone 'Asia/Seoul','YYYY-MM-DD') as day,count(*)::int as attempts
      from hanlog.attempts where user_id = $1 and created_at >= $2 and created_at <= $3 group by day`, [userId, since, now.toISOString()]),
    db.query<AttemptRow>(`select ${attemptFields} from hanlog.attempts where user_id = $1 and created_at <= $2 order by created_at desc,id desc limit 8`, [userId, now.toISOString()]),
    db.query<{ mission_id: string; best: number }>('select mission_id,max(overall)::int as best from hanlog.attempts where user_id = $1 and created_at <= $2 group by mission_id', [userId, now.toISOString()]),
    db.query<{ mission_id: string }>('select mission_id from hanlog.saved_missions where user_id = $1 order by created_at desc,mission_id', [userId]),
  ]);
  const progress = new Map(prior.map(row => [row.mission_id, row.best]));
  const unpracticed = missions.find(mission => !progress.has(mission.id));
  const review = [...missions].sort((a, b) => (progress.get(a.id) ?? 0) - (progress.get(b.id) ?? 0))[0];
  const weeklyActivity = days.map(date => ({ date, attempts: week.find(row => row.day === date)?.attempts ?? 0 }));
  return {
    totalAttempts: totals[0].total, practicedMissions: totals[0].practiced, strongMissions: totals[0].strong, totalMissions: missions.length,
    practiceDays: totals[0].days, currentStreak: streaks[0].current, longestStreak: streaks[0].longest,
    practicedToday: weeklyActivity[6].attempts > 0, averageScore: totals[0].average === null ? null : Number(totals[0].average),
    weeklyActivity, recentAttempts: recent.map(toAttempt), recommendedMissionId: unpracticed?.id ?? review?.id ?? null,
    savedMissionIds: saved.map(row => row.mission_id).filter(id => getMission(id) !== null),
  };
}

export async function setSavedMission(userId: string, missionId: string, saved: boolean, expectedVersion?: number): Promise<void> {
  if (!getMission(missionId)) throw new ApiError('not_found');
  const db = await getDb();
  await db.tx(async tx => {
    await tx.query('select pg_advisory_xact_lock(hashtext($1))', [userId]);
    await lockSessionUser(tx, userId, expectedVersion);
    if (saved) await tx.query(`insert into hanlog.saved_missions (user_id,mission_id) values ($1,$2)
      on conflict (user_id,mission_id) do nothing`, [userId, missionId]);
    else await tx.query('delete from hanlog.saved_missions where user_id = $1 and mission_id = $2', [userId, missionId]);
  });
}
