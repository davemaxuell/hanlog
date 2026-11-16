import { createHash, createHmac, randomBytes } from 'node:crypto';
import { getDb, type Db } from '../db';
import { ApiError } from '../errors';
import type { User } from '../contracts';
import type { AccountStatus } from '../account-contracts';
import { getConfig } from '../config';

type AccountRow = { id: string; nickname: string; role: User['role']; created_at: Date | string; session_version: number };
type RecoveryResult = { user: User; recoveryKey: string; version: number };
const toUser = (row: AccountRow): User => ({ id: row.id, nickname: row.nickname, role: row.role, createdAt: new Date(row.created_at).toISOString() });
const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');
const newKey = () => `hlk_${randomBytes(32).toString('base64url')}`;
const replacementKey = (oldKey: string, requestId: string) => `hlk_${createHmac('sha256', getConfig().sessionSecret).update('hanlog-recovery-v1\0').update(oldKey).update('\0').update(requestId).digest('base64url')}`;

export async function accountStatus(userId: string): Promise<AccountStatus> {
  const [row] = await (await getDb()).query<{ enabled: boolean; updated_at: Date | string | null }>('select recovery_key_hash is not null as enabled, recovery_updated_at as updated_at from hanlog.users where id = $1', [userId]);
  if (!row) throw new ApiError('unauthenticated');
  return { recoveryEnabled: row.enabled, recoveryUpdatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null };
}

export async function rotateRecoveryKey(userId: string, expectedVersion: number) {
  const recoveryKey = newKey();
  const [row] = await (await getDb()).query<AccountRow>(`update hanlog.users set recovery_key_hash = $3, recovery_updated_at = now(),
    recovery_previous_hash = null, recovery_request_hash = null, recovery_retry_expires_at = null, recovery_retry_version = null
    where id = $1 and session_version = $2 returning id,nickname,role,created_at,session_version`, [userId, expectedVersion, hashKey(recoveryKey)]);
  if (!row) throw new ApiError('unauthenticated');
  return { user: toUser(row), recoveryKey, version: row.session_version };
}

const recoveryLimit = () => new ApiError('daily_limit', 'Too many recovery attempts. Please wait 15 minutes before trying again.');
const invalidRecovery = () => new ApiError('unauthenticated', 'That recovery key is invalid or has already been replaced.');

async function reserveRecoveryAttemptWith(db: Db, ipHash: string): Promise<boolean> {
  const [row] = await db.query<{ attempts: number }>(`insert into hanlog.recovery_attempt_limits (ip_hash, attempts) values ($1,1)
    on conflict (ip_hash) do update set
      attempts = case when hanlog.recovery_attempt_limits.window_start <= now() - interval '15 minutes' then 1 else least(hanlog.recovery_attempt_limits.attempts + 1, 11) end,
      window_start = case when hanlog.recovery_attempt_limits.window_start <= now() - interval '15 minutes' then now() else hanlog.recovery_attempt_limits.window_start end
    returning attempts`, [ipHash]);
  if (row.attempts > 10) return false;
  return true;
}

async function purgeRecoveryAttempts(db: Db): Promise<void> {
  // Run after the decision commits so cleanup cannot lock another request's old
  // throttle row while this request still holds its own renewed row lock.
  await db.query("delete from hanlog.recovery_attempt_limits where window_start < now() - interval '1 day'");
}

export async function reserveRecoveryAttempt(ipHash: string): Promise<void> {
  const db = await getDb();
  if (!await reserveRecoveryAttemptWith(db, ipHash)) throw recoveryLimit();
  await purgeRecoveryAttempts(db);
}

async function retryRestoredAccountWith(db: Db, oldKey: string, requestId: string): Promise<RecoveryResult | null> {
  const recoveryKey = replacementKey(oldKey, requestId);
  // A proven retry is the remainder of an already-authorized restore, not a new
  // credential guess. The conditional row lock rechecks concurrent revocation;
  // every stored value, including expiry and session version, stays unchanged.
  const [row] = await db.query<AccountRow>(`update hanlog.users set recovery_key_hash = recovery_key_hash
    where recovery_previous_hash = $1 and recovery_request_hash = $3 and recovery_key_hash = $2
      and recovery_retry_expires_at > clock_timestamp() and recovery_retry_version = session_version
    returning id,nickname,role,created_at,session_version`, [hashKey(oldKey), hashKey(recoveryKey), hashKey(requestId)]);
  return row ? { user: toUser(row), recoveryKey, version: row.session_version } : null;
}

async function restoreAccountWith(db: Db, oldKey: string, requestId: string): Promise<RecoveryResult | null> {
  const recoveryKey = replacementKey(oldKey, requestId);
  // This UPDATE rechecks its condition after a concurrent restore. Only one nonce
  // can consume a key. The same old-key/nonce proof can recover a lost response
  // for five minutes without changing the key or revoking the new session again.
  // A later rotation, restore or sign-out clears/replaces that proof.
  const [row] = await db.query<AccountRow>(`update hanlog.users set
    recovery_updated_at = case when recovery_key_hash = $1 then clock_timestamp() else recovery_updated_at end,
    recovery_retry_expires_at = case when recovery_key_hash = $1 then clock_timestamp() + interval '5 minutes' else recovery_retry_expires_at end,
    recovery_retry_version = case when recovery_key_hash = $1 then session_version + 1 else session_version end,
    session_version = case when recovery_key_hash = $1 then session_version + 1 else session_version end,
    recovery_key_hash = $2, recovery_previous_hash = $1, recovery_request_hash = $3
    where recovery_key_hash = $1 or (
      recovery_previous_hash = $1 and recovery_request_hash = $3 and recovery_key_hash = $2
      and recovery_retry_expires_at > clock_timestamp() and recovery_retry_version = session_version
    ) returning id,nickname,role,created_at,session_version`, [hashKey(oldKey), hashKey(recoveryKey), hashKey(requestId)]);
  return row ? { user: toUser(row), recoveryKey, version: row.session_version } : null;
}

export async function restoreAccount(oldKey: string, requestId: string): Promise<RecoveryResult> {
  const restored = await restoreAccountWith(await getDb(), oldKey, requestId);
  if (!restored) throw invalidRecovery();
  return restored;
}

export async function restoreAccountWithLimit(oldKey: string, requestId: string, ipHash: string): Promise<RecoveryResult> {
  const db = await getDb();
  let outcome: { restored: RecoveryResult | null; limited: boolean; reserved: boolean };
  try {
    outcome = await db.tx(async db => {
      // Serialize the entire decision for this old key: an identical retry must
      // observe the original commit before deciding whether it needs a new slot.
      // Only a digest reaches PostgreSQL's advisory-lock query, never a raw key.
      await db.query("set local lock_timeout = '5s'");
      await db.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`recovery:${hashKey(oldKey)}`]);
      const retry = await retryRestoredAccountWith(db, oldKey, requestId);
      if (retry) return { restored: retry, limited: false, reserved: false };
      if (!await reserveRecoveryAttemptWith(db, ipHash)) return { restored: null, limited: true, reserved: false };
      return { restored: await restoreAccountWith(db, oldKey, requestId), limited: false, reserved: true };
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '55P03') {
      throw new ApiError('service_unavailable', 'Recovery is still finishing. Please try again shortly using the same key.');
    }
    throw error;
  }
  // Throw after COMMIT so invalid first-use guesses still consume their slot.
  if (outcome.reserved) await purgeRecoveryAttempts(db);
  if (outcome.limited) throw recoveryLimit();
  if (!outcome.restored) throw invalidRecovery();
  return outcome.restored;
}

export async function revokeSessions(userId: string, expectedVersion: number): Promise<void> {
  const rows = await (await getDb()).query(`update hanlog.users set session_version = session_version + 1,
    recovery_previous_hash = null, recovery_request_hash = null, recovery_retry_expires_at = null, recovery_retry_version = null
    where id = $1 and session_version = $2 returning id`, [userId, expectedVersion]);
  if (!rows.length) throw new ApiError('unauthenticated');
}

type ExportRow = Record<string, unknown> & { id: string };
async function* rows(db: Db, query: string, userId: string): AsyncGenerator<Record<string, unknown>> {
  let last = '';
  while (true) {
    const page = await db.query<ExportRow>(`${query} and id::text > $2 order by id limit 250`, [userId, last]);
    for (const row of page) yield row;
    if (page.length < 250) return;
    last = page[page.length - 1].id;
  }
}

/** An owned-data export with bounded database pages and no credential/media paths. */
export async function createAccountExport(user: User): Promise<ReadableStream<Uint8Array>> {
  const db = await getDb();
  const saved = await db.query<{ missionId: string; createdAt: Date | string }>('select mission_id as "missionId", created_at as "createdAt" from hanlog.saved_missions where user_id = $1 order by mission_id', [user.id]);
  const [reportsTable] = await db.query<{ present: boolean }>("select to_regclass('hanlog.community_reports') is not null as present");
  const sections = [
    ['attempts', 'select id,mission_id as "missionId",overall,pronunciation,accuracy,usage,heard,feedback,scored_by as "scoredBy",points_awarded as "pointsAwarded",created_at as "createdAt" from hanlog.attempts where user_id = $1'],
    ['pointEvents', 'select id,delta,reason,label,created_at as "createdAt" from hanlog.point_events where user_id = $1'],
    ['challenges', 'select id,code,korean,meaning_en as "meaningEn",situation_en as "situationEn",status,created_at as "createdAt" from hanlog.challenges where author_id = $1'],
    ['responses', 'select id,challenge_id as "challengeId",media_kind as "mediaKind",duration_ms as "durationMs",status,rating_pronunciation as "ratingPronunciation",rating_naturalness as "ratingNaturalness",rating_comment as "ratingComment",rated_at as "ratedAt",feedback_helpfulness as "feedbackHelpfulness",feedback_comment as "feedbackComment",feedback_at as "feedbackAt",created_at as "createdAt" from hanlog.challenge_responses where responder_id = $1'],
    ['ratingsGiven', 'select id,challenge_id as "challengeId",rating_pronunciation as "pronunciation",rating_naturalness as "naturalness",rating_comment as "comment",rated_at as "ratedAt" from hanlog.challenge_responses where rater_id = $1'],
    ...(reportsTable.present ? [['reports', 'select id,challenge_id as "challengeId",response_id as "responseId",reason,status,created_at as "createdAt",reviewed_at as "reviewedAt" from hanlog.community_reports where reporter_id = $1']] : []),
    ['posts', 'select id,korean,meaning_en as "meaningEn",note,width,height,status,(image_path is not null) as "photoAvailable",created_at as "createdAt" from hanlog.posts where author_id = $1'],
    // The pager appends "and id::text > $2", so joined sections expose one unambiguous id through a derived table.
    ['likedPosts', 'select id,"likedAt" from (select post_id as id,created_at as "likedAt",user_id from hanlog.post_likes) liked where user_id = $1'],
    ['postReports', 'select id,post_id as "postId",reason,status,created_at as "createdAt" from hanlog.post_reports where reporter_id = $1'],
    ['groups', 'select id,name,code,"isOwner","joinedAt" from (select g.id,g.name,g.code,(g.owner_id = m.user_id) as "isOwner",m.joined_at as "joinedAt",m.user_id from hanlog.group_members m join hanlog.groups g on g.id = m.group_id) joined where user_id = $1'],
  ];
  async function* document() {
    yield JSON.stringify({ formatVersion: 1, exportedAt: new Date().toISOString(), profile: user, savedMissions: saved }).slice(0, -1);
    for (const [name, query] of sections) {
      yield `,${JSON.stringify(name)}:[`;
      let first = true;
      for await (const row of rows(db, query, user.id)) { yield `${first ? '' : ','}${JSON.stringify(row)}`; first = false; }
      yield ']';
    }
    yield '}';
  }
  const iterator = document(); const encoder = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      try { const part = await iterator.next(); if (part.done) controller.close(); else controller.enqueue(encoder.encode(part.value)); }
      catch { controller.error(new Error('Data export could not finish. Please try again.')); }
    },
    async cancel() { await iterator.return(); },
  });
}
