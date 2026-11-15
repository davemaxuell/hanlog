import { randomInt } from 'node:crypto';
import { SHARE_CODE_ALPHABET, type Challenge, type ChallengeScope, type User } from '../contracts';
import { getDb, type Db } from '../db';
import { getConfig } from '../config';
import { ApiError } from '../errors';
import { kstDayStartIso } from '../http';
import { lockMediaPaths } from '../media/pending';
import { encodeCommunityCursor, type CommunityCursor } from './community-pagination';
import type { ChallengePage } from '../community-contracts';

export type ChallengeRecord = { id: string; code: string; authorId: string; authorNickname: string; korean: string; meaningEn: string; situationEn: string; referencePath: string | null; referenceMime: string | null; isSample: boolean; status: 'open' | 'hidden'; createdAt: string };
type Row = { id: string; code: string; author_id: string; author_nickname: string; korean: string; meaning_en: string; situation_en: string; reference_path: string | null; reference_mime: string | null; is_sample: boolean; status: 'open' | 'hidden'; created_at: Date | string; cursor_at: string };
const select = `select c.*, to_char(c.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_at, u.nickname as author_nickname from hanlog.challenges c join hanlog.users u on u.id = c.author_id`;
const map = (r: Row): ChallengeRecord => ({ id: r.id, code: r.code, authorId: r.author_id, authorNickname: r.author_nickname, korean: r.korean, meaningEn: r.meaning_en, situationEn: r.situation_en, referencePath: r.reference_path, referenceMime: r.reference_mime, isSample: r.is_sample, status: r.status, createdAt: new Date(r.created_at).toISOString() });
export const CHALLENGES_PER_DAY = 10;
export function mediaWithinRetention(createdAt: string): boolean {
  return new Date(createdAt).getTime() > Date.now() - getConfig().retentionDays * 86_400_000;
}
async function count(db: Db, authorId: string, since: string): Promise<number> {
  return (await db.query<{ n: number }>('select count(*)::int as n from hanlog.challenges where author_id = $1 and created_at >= $2', [authorId, since]))[0].n;
}
export async function countChallengesSince(authorId: string, sinceIso: string): Promise<number> { return count(await getDb(), authorId, sinceIso); }
export async function createChallenge(input: { authorId: string; korean: string; meaningEn: string; situationEn: string }): Promise<ChallengeRecord> {
  return (await getDb()).tx(async db => {
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [input.authorId]);
    if (await count(db, input.authorId, kstDayStartIso()) >= CHALLENGES_PER_DAY) throw new ApiError('daily_limit');
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = Array.from({ length: 6 }, () => SHARE_CODE_ALPHABET[randomInt(SHARE_CODE_ALPHABET.length)]).join('');
      const rows = await db.query<{ id: string }>('insert into hanlog.challenges (code, author_id, korean, meaning_en, situation_en) values ($1,$2,$3,$4,$5) on conflict (code) do nothing returning id', [code, input.authorId, input.korean, input.meaningEn, input.situationEn]);
      if (rows.length) return map((await db.query<Row>(`${select} where c.id = $1`, [rows[0].id]))[0]);
    }
    throw new ApiError('service_unavailable');
  });
}
export async function setChallengeReference(id: string, path: string, mime: string, write?: () => Promise<void>): Promise<void> {
  const initial = await getChallengeRecord(id);
  if (!initial) throw new ApiError('not_found');
  await (await getDb()).tx(async db => {
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [initial.authorId]);
    if (!(await db.query('select id from hanlog.challenges where id = $1 for update', [id])).length) throw new ApiError('not_found');
    await lockMediaPaths(db, [path]);
    if (write) await write();
    const rows = await db.query<{ id: string }>('update hanlog.challenges set reference_path = $2, reference_mime = $3 where id = $1 returning id', [id, path, mime]);
    // Deletion can finish while the upload is in flight; trigger the route's file compensation.
    if (!rows.length) throw new ApiError('not_found');
    await db.query('delete from hanlog.pending_media_deletions where path = $1', [path]);
  });
}
export async function removeIncompleteChallenge(id: string): Promise<void> {
  await (await getDb()).tx(async db => {
    await db.query('select id from hanlog.challenges where id = $1 for update', [id]);
    // A separate statement gets a fresh snapshot after any in-flight answer/reference commits.
    await db.query('delete from hanlog.challenges c where c.id = $1 and c.reference_path is null and not exists(select 1 from hanlog.challenge_responses r where r.challenge_id = c.id)', [id]);
  });
}
export async function getChallengeRecord(idOrCode: string, viewerId?: string): Promise<ChallengeRecord | null> {
  const visible = viewerId ? " and not exists(select 1 from hanlog.community_reports report where report.challenge_id=c.id and report.response_id is null and report.reporter_id=$2 and report.status in ('open','actioned'))" : '';
  const rows = await (await getDb()).query<Row>(`${select} where c.status = 'open' and (c.id::text = $1 or c.code = upper($1))${visible}`, viewerId ? [idOrCode, viewerId] : [idOrCode]);
  return rows[0] ? map(rows[0]) : null;
}
type Stats = { responded: boolean; pending: number };
function presentChallenge(record: ChallengeRecord, viewer: User, stats: Stats): Challenge {
  const mayRate = record.authorId === viewer.id || (record.isSample && viewer.role === 'korean');
  return { id: record.id, code: record.code, author: { id: record.authorId, nickname: record.authorNickname }, korean: record.korean, meaningEn: record.meaningEn, situationEn: record.situationEn, hasReference: !!record.referencePath && mediaWithinRetention(record.createdAt), isSample: record.isSample, createdAt: record.createdAt, viewer: { responded: stats.responded, pendingToRate: mayRate ? stats.pending : 0 } };
}
export async function toChallenge(record: ChallengeRecord, viewer: User): Promise<Challenge> {
  const [stats] = await (await getDb()).query<Stats>(`select exists(select 1 from hanlog.challenge_responses where challenge_id = $1 and responder_id = $2) as responded, (select count(*)::int from hanlog.challenge_responses where challenge_id = $1 and responder_id <> $2 and status = 'pending' and not flagged) as pending`, [record.id, viewer.id]);
  return presentChallenge(record, viewer, stats);
}
export async function listChallenges(scope: ChallengeScope, viewer: User): Promise<Challenge[]> {
  return (await listChallengePage(scope, viewer, { limit: 50 })).challenges;
}
export async function listChallengePage(scope: ChallengeScope, viewer: User, options: { limit: number; cursor?: CommunityCursor | null; q?: string }): Promise<ChallengePage> {
  const conditions: Record<ChallengeScope, string> = {
    open: 'c.author_id <> $1', mine: 'c.author_id = $1',
    answered: 'exists(select 1 from hanlog.challenge_responses r where r.challenge_id = c.id and r.responder_id = $1)',
    'to-rate': `(c.author_id = $1 or (c.is_sample and $2 = 'korean')) and exists(select 1 from hanlog.challenge_responses r where r.challenge_id = c.id and r.responder_id <> $1 and r.status = 'pending' and not r.flagged)`,
  };
  const db = await getDb();
  const values: unknown[] = scope === 'to-rate' ? [viewer.id, viewer.role] : [viewer.id];
  let where = conditions[scope];
  if (options.q) { values.push(options.q); where += ` and position(lower($${values.length}) in lower(c.korean || ' ' || c.meaning_en || ' ' || c.situation_en || ' ' || u.nickname)) > 0`; }
  if (options.cursor) { values.push(options.cursor.at, options.cursor.id); where += ` and (c.created_at,c.id) < ($${values.length - 1}::timestamptz,$${values.length}::uuid)`; }
  values.push(options.limit + 1);
  const rows = await db.query<Row>(`${select} where c.status = 'open' and not exists(select 1 from hanlog.community_reports report where report.challenge_id=c.id and report.response_id is null and report.reporter_id=$1 and report.status in ('open','actioned')) and ${where} order by c.created_at desc, c.id desc limit $${values.length}`, values);
  const page = rows.slice(0, options.limit);
  const stats = page.length ? await db.query<Stats & { challenge_id: string }>(`select challenge_id, bool_or(responder_id = $2) as responded, count(*) filter(where responder_id <> $2 and status = 'pending' and not flagged)::int as pending from hanlog.challenge_responses where challenge_id = any($1::uuid[]) group by challenge_id`, [page.map(row => row.id), viewer.id]) : [];
  const byId = new Map(stats.map(stat => [stat.challenge_id, stat]));
  const last = page.at(-1);
  return { challenges: page.map(row => presentChallenge(map(row), viewer, byId.get(row.id) ?? { responded: false, pending: 0 })), nextCursor: rows.length > options.limit && last ? encodeCommunityCursor(last.cursor_at, last.id) : null };
}
