import { randomUUID } from 'node:crypto';
import type { ChallengeResponse, MediaKind, User } from '../contracts';
import { getDb, type Db } from '../db';
import { ApiError } from '../errors';
import { kstDayStartIso } from '../http';
import { getMediaStore } from '../media';
import { mediaWithinRetention } from './challenges';

export type ResponseRecord = ChallengeResponse & { mediaPath: string | null; mediaMime: string; flagged: boolean; raterId: string | null; challengeAuthorId: string; challengeIsSample: boolean };
type Row = {
  id: string; challenge_id: string; responder_id: string; nickname: string;
  media_path: string | null; media_kind: MediaKind; media_mime: string; duration_ms: number;
  status: 'pending' | 'rated'; flagged: boolean; rater_id: string | null;
  rating_pronunciation: number | null; rating_naturalness: number | null; rating_comment: string | null; rated_at: Date | string | null;
  feedback_helpfulness: number | null; feedback_comment: string | null; feedback_at: Date | string | null;
  created_at: Date | string; author_id: string; is_sample: boolean;
};
const select = `select r.*, u.nickname, c.author_id, c.is_sample from hanlog.challenge_responses r join hanlog.users u on u.id = r.responder_id join hanlog.challenges c on c.id = r.challenge_id`;
function map(row: Row): ResponseRecord {
  const createdAt = new Date(row.created_at).toISOString();
  return {
    id: row.id, challengeId: row.challenge_id, responder: { id: row.responder_id, nickname: row.nickname }, mediaKind: row.media_kind,
    mediaAvailable: !!row.media_path && !row.flagged && mediaWithinRetention(createdAt), durationMs: row.duration_ms, status: row.status,
    rating: row.rated_at ? { pronunciation: row.rating_pronunciation!, naturalness: row.rating_naturalness!, comment: row.rating_comment ?? '', ratedAt: new Date(row.rated_at).toISOString() } : null,
    feedback: row.feedback_at ? { helpfulness: row.feedback_helpfulness!, comment: row.feedback_comment ?? '', givenAt: new Date(row.feedback_at).toISOString() } : null,
    createdAt, mediaPath: row.media_path, mediaMime: row.media_mime, flagged: row.flagged, raterId: row.rater_id, challengeAuthorId: row.author_id, challengeIsSample: row.is_sample,
  };
}
export function publicResponse(record: ResponseRecord): ChallengeResponse {
  return { id: record.id, challengeId: record.challengeId, responder: record.responder, mediaKind: record.mediaKind, mediaAvailable: record.mediaAvailable, durationMs: record.durationMs, status: record.status, rating: record.rating, feedback: record.feedback, createdAt: record.createdAt };
}
export async function getResponseRecord(id: string): Promise<ResponseRecord | null> {
  const rows = await (await getDb()).query<Row>(`${select} where r.id::text = $1 and c.status = 'open'`, [id]);
  return rows[0] ? map(rows[0]) : null;
}
export async function getMyResponse(challengeId: string, responderId: string): Promise<ChallengeResponse | null> {
  const rows = await (await getDb()).query<Row>(`${select} where r.challenge_id = $1 and r.responder_id = $2 and c.status = 'open'`, [challengeId, responderId]);
  return rows[0] ? publicResponse(map(rows[0])) : null;
}
export async function listResponses(challengeId: string): Promise<ChallengeResponse[]> {
  const rows = await (await getDb()).query<Row>(`${select} where r.challenge_id = $1 and not r.flagged and c.status = 'open' order by (r.status = 'pending') desc, r.created_at desc, r.id desc`, [challengeId]);
  return rows.map(row => publicResponse(map(row)));
}
export function canRate(record: ResponseRecord, viewer: User): boolean {
  return record.responder.id !== viewer.id && (record.challengeAuthorId === viewer.id || (record.challengeIsSample && viewer.role === 'korean'));
}
export function canView(record: ResponseRecord, viewer: User): boolean { return record.responder.id === viewer.id || canRate(record, viewer); }
export const RESPONSES_PER_DAY = 30;
async function count(db: Db, responderId: string, sinceIso: string): Promise<number> {
  return (await db.query<{ n: number }>('select count(*)::int as n from hanlog.challenge_responses where responder_id = $1 and created_at >= $2', [responderId, sinceIso]))[0].n;
}
export async function countResponsesSince(responderId: string, sinceIso: string): Promise<number> { return count(await getDb(), responderId, sinceIso); }

// Bytes are supplied here so the row lock covers storage as well as the SQL update.
// Cleanup and rating take the same row lock and cannot observe a partial replacement.
export async function upsertResponse(input: { challengeId: string; responderId: string; mediaKind: MediaKind; mediaMime: string; ext: string; durationMs: number; bytes: Uint8Array }): Promise<{ record: ResponseRecord; replacedPath: string | null }> {
  return (await getDb()).tx(async db => {
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [input.responderId]);
    const challenges = await db.query<{ author_id: string; status: string }>('select author_id, status from hanlog.challenges where id = $1 for share', [input.challengeId]);
    if (!challenges[0] || challenges[0].status !== 'open') throw new ApiError('not_found');
    if (challenges[0].author_id === input.responderId) throw new ApiError('forbidden');
    if (await count(db, input.responderId, kstDayStartIso()) >= RESPONSES_PER_DAY) throw new ApiError('daily_limit');
    const old = (await db.query<Row>(`${select} where r.challenge_id = $1 and r.responder_id = $2 for update of r`, [input.challengeId, input.responderId]))[0];
    if (old?.flagged) throw new ApiError('not_found');
    if (old?.status === 'rated') throw new ApiError('conflict');
    const id = old?.id ?? randomUUID();
    const path = `responses/${id}.${input.ext}`;
    const store = getMediaStore();
    const oldBytes = old?.media_path ? await store.get(old.media_path) : null;
    let writeStarted = false;
    try {
      if (old) await db.query(`update hanlog.challenge_responses set media_path = $2, media_kind = $3, media_mime = $4, duration_ms = $5, created_at = now() where id = $1`, [id, path, input.mediaKind, input.mediaMime, input.durationMs]);
      else await db.query(`insert into hanlog.challenge_responses (id, challenge_id, responder_id, media_path, media_kind, media_mime, duration_ms) values ($1,$2,$3,$4,$5,$6,$7)`, [id, input.challengeId, input.responderId, path, input.mediaKind, input.mediaMime, input.durationMs]);
      writeStarted = true;
      await store.put(path, input.bytes, input.mediaMime);
      if (old?.media_path && old.media_path !== path) await store.remove([old.media_path]);
      const record = map((await db.query<Row>(`${select} where r.id = $1`, [id]))[0]);
      return { record, replacedPath: old?.media_path ?? null };
    } catch {
      if (writeStarted) {
        try {
          if (old?.media_path && oldBytes) await store.put(old.media_path, oldBytes, old.media_mime);
          if (path !== old?.media_path || !oldBytes) await store.remove([path]);
        } catch { console.error('[media] response compensation failed', { path }); }
      }
      throw new ApiError('service_unavailable');
    }
  });
}
