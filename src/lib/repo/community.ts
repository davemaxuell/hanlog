import type { User } from '../contracts';
import type { InboxItem, InboxPage, ReportReason } from '../community-contracts';
import { getDb, type Db } from '../db';
import { ApiError } from '../errors';
import { kstDayStartIso } from '../http';
import { canView, getResponseRecord } from './responses';
import { encodeCommunityCursor, type CommunityCursor } from './community-pagination';
import { lockSessionUser } from './users';

export const REPORTS_PER_DAY = 10;
async function reportAllowed(db: Db, reporterId: string, targetId: string, response: boolean): Promise<boolean> {
  const existing = await db.query(`select id from hanlog.community_reports where reporter_id=$1 and ${response ? 'response_id=$2' : 'challenge_id=$2 and response_id is null'}`, [reporterId, targetId]);
  if (existing.length) return false;
  const [daily] = await db.query<{ n: number }>('select count(*)::int as n from hanlog.community_reports where reporter_id=$1 and created_at >= $2', [reporterId, kstDayStartIso()]);
  if (daily.n >= REPORTS_PER_DAY) throw new ApiError('daily_limit');
  return true;
}

export async function reportCommunityTarget(viewer: User, input: { responseId?: string; challengeId?: string; reason: ReportReason; expectedVersion?: number }): Promise<void> {
  const db = await getDb();
  if (input.responseId) {
    const record = await getResponseRecord(input.responseId, viewer.id);
    if (!record) throw new ApiError('not_found');
    await db.tx(async tx => {
      await tx.query('select pg_advisory_xact_lock(hashtext($1))', [viewer.id]);
      const currentViewer = await lockSessionUser(tx, viewer.id, input.expectedVersion);
      if (!canView(record, currentViewer)) throw new ApiError('forbidden');
      if (!await reportAllowed(tx, viewer.id, record.id, true)) return;
      // The report insert checks its parent FK. Lock the parent before its answer,
      // matching profile deletion and cleanup rather than deadlocking with them.
      if (!(await tx.query("select id from hanlog.challenges where id=$1 and status='open' for share", [record.challengeId])).length) throw new ApiError('not_found');
      if (!(await tx.query('select id from hanlog.challenge_responses where id=$1 for update', [record.id])).length) throw new ApiError('not_found');
      if (!await getResponseRecord(record.id, viewer.id, tx)) throw new ApiError('not_found');
      const inserted = await tx.query('insert into hanlog.community_reports(reporter_id,challenge_id,response_id,reason) values($1,$2,$3,$4) on conflict do nothing returning id', [viewer.id, record.challengeId, record.id, input.reason]);
      if (inserted.length) await tx.query('update hanlog.challenge_responses set flagged=true where id=$1', [record.id]);
    });
    return;
  }
  if (!input.challengeId) throw new ApiError('invalid_input');
  await db.tx(async tx => {
    await tx.query('select pg_advisory_xact_lock(hashtext($1))', [viewer.id]);
    await lockSessionUser(tx, viewer.id, input.expectedVersion);
    const rows = await tx.query<{ id: string; author_id: string }>("select id,author_id from hanlog.challenges where id::text=$1 and status='open'", [input.challengeId]);
    if (!rows.length) throw new ApiError('not_found');
    if (rows[0].author_id === viewer.id) throw new ApiError('forbidden');
    if (!await reportAllowed(tx, viewer.id, rows[0].id, false)) return;
    await tx.query('insert into hanlog.community_reports(reporter_id,challenge_id,reason) values($1,$2,$3) on conflict do nothing', [viewer.id, rows[0].id, input.reason]);
  });
}

/** Operator-only primitive: exposed through the local CLI, never a user-role API. */
export async function reviewReport(db: Db, reportId: string, decision: 'dismissed' | 'actioned'): Promise<void> {
  await db.tx(async tx => {
    const [report] = await tx.query<{ challenge_id: string; response_id: string | null }>('select challenge_id,response_id from hanlog.community_reports where id::text=$1', [reportId]);
    if (!report) throw new ApiError('not_found');
    // One lock per target keeps simultaneous reviews from revealing another active report.
    if (report.response_id) await tx.query('select id from hanlog.challenge_responses where id=$1 for update', [report.response_id]);
    else await tx.query('select id from hanlog.challenges where id=$1 for update', [report.challenge_id]);
    // A reporter deletion may cascade this report while we wait for the target.
    // Do not turn an intended action into an unhide when no audit row was updated.
    const reviewed = await tx.query('update hanlog.community_reports set status=$2,reviewed_at=now() where id=$1 returning id', [reportId, decision]);
    if (!reviewed.length) throw new ApiError('not_found');
    const [active] = await tx.query<{ n: number }>(`select count(*)::int as n from hanlog.community_reports where ${report.response_id ? "response_id=$1 and status in ('open','actioned')" : "challenge_id=$1 and response_id is null and status='actioned'"}`, [report.response_id ?? report.challenge_id]);
    if (report.response_id) await tx.query('update hanlog.challenge_responses set flagged=$2 where id=$1', [report.response_id, active.n > 0]);
    else await tx.query('update hanlog.challenges set status=$2 where id=$1', [report.challenge_id, active.n > 0 ? 'hidden' : 'open']);
  });
}

type InboxRow = { id: string; kind: 'rating' | 'feedback'; challenge_id: string; korean: string; meaning_en: string; nickname: string; comment: string; created_at: string | Date; cursor_at: string; pronunciation: number | null; naturalness: number | null; helpfulness: number | null; needs_feedback: boolean };
export async function communityInbox(userId: string, options: { limit: number; cursor?: CommunityCursor | null }): Promise<InboxPage> {
  const values: unknown[] = [userId];
  let where = '';
  if (options.cursor) { values.push(options.cursor.at, options.cursor.id); where = 'where (created_at,id) < ($2::timestamptz,$3::uuid)'; }
  values.push(options.limit + 1);
  const rows = await (await getDb()).query<InboxRow>(`with activity as (
    select r.id,'rating'::text as kind,c.id as challenge_id,c.korean,c.meaning_en,coalesce(u.nickname,'Former member') as nickname,
      coalesce(r.rating_comment,'') as comment,r.rated_at as created_at,r.rating_pronunciation as pronunciation,r.rating_naturalness as naturalness,null::int as helpfulness,(r.feedback_at is null) as needs_feedback
    from hanlog.challenge_responses r join hanlog.challenges c on c.id=r.challenge_id left join hanlog.users u on u.id=r.rater_id
    where r.responder_id=$1 and r.rated_at is not null and not r.flagged and c.status='open' and not exists(select 1 from hanlog.community_reports cr where cr.reporter_id=$1 and cr.challenge_id=c.id and cr.response_id is null and cr.status in ('open','actioned'))
    union all
    select r.id,'feedback'::text,c.id,c.korean,c.meaning_en,u.nickname,coalesce(r.feedback_comment,''),r.feedback_at,null::int,null::int,r.feedback_helpfulness,false
    from hanlog.challenge_responses r join hanlog.challenges c on c.id=r.challenge_id join hanlog.users u on u.id=r.responder_id
    where r.rater_id=$1 and r.feedback_at is not null and not r.flagged and c.status='open' and not exists(select 1 from hanlog.community_reports cr where cr.reporter_id=$1 and cr.challenge_id=c.id and cr.response_id is null and cr.status in ('open','actioned'))
  ) select *,to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_at from activity ${where} order by created_at desc,id desc limit $${values.length}`, values);
  const page = rows.slice(0, options.limit); const last = page.at(-1);
  const items: InboxItem[] = page.map(row => ({ id: `${row.kind}-${row.id}`, kind: row.kind, responseId: row.id, challengeId: row.challenge_id, korean: row.korean, meaningEn: row.meaning_en, nickname: row.nickname, comment: row.comment, createdAt: new Date(row.created_at).toISOString(), pronunciation: row.pronunciation, naturalness: row.naturalness, helpfulness: row.helpfulness, needsFeedback: row.needs_feedback }));
  return { items, nextCursor: rows.length > options.limit && last ? encodeCommunityCursor(last.cursor_at, last.id) : null };
}
