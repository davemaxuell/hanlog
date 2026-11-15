import { getConfig } from '../config';
import { getDb } from '../db';
import { kstDayStartIso } from '../http';
import { getMediaStore } from './index';
import { lockMediaPaths } from './pending';
export async function cleanupExpiredMedia(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - getConfig().retentionDays * 86400000).toISOString();
  return (await getDb()).tx(async db => {
    await db.query("select pg_advisory_xact_lock(hashtext('cleanup_media'))");
    // Parent rows first: account deletion also locks/deletes challenges before their answers.
    const references = await db.query<{ id: string; reference_path: string }>('select id, reference_path from hanlog.challenges where reference_path is not null and created_at <= $1 order by id for update', [cutoff]);
    const answers = await db.query<{ id: string; media_path: string }>('select id, media_path from hanlog.challenge_responses where media_path is not null and created_at <= $1 order by id for update', [cutoff]);
    // Only abandoned, unreferenced paths qualify. The hour exceeds request lifetimes and protects uploads in flight.
    const candidates = await db.query<{ path: string }>(`select p.path from hanlog.pending_media_deletions p
      where p.created_at <= $1
      and not exists(select 1 from hanlog.challenges c where c.reference_path = p.path)
      and not exists(select 1 from hanlog.challenge_responses r where r.media_path = p.path)
      order by p.path`, [new Date(now.getTime() - 3_600_000).toISOString()]);
    await lockMediaPaths(db, [...references.map(r => r.reference_path), ...answers.map(r => r.media_path), ...candidates.map(r => r.path)]);
    // Recheck after taking the same locks as metadata attachment/compensation.
    const abandoned = candidates.length ? await db.query<{ path: string }>(`select p.path from hanlog.pending_media_deletions p
      where p.path = any($1::text[])
      and not exists(select 1 from hanlog.challenges c where c.reference_path = p.path)
      and not exists(select 1 from hanlog.challenge_responses r where r.media_path = p.path)
      order by p.path for update`, [candidates.map(r => r.path)]) : [];
    // Spending caps only use the current Korea-time day; older counters are unnecessary.
    await db.query('delete from hanlog.scoring_calls where created_at < $1', [kstDayStartIso(now)]);
    await db.query('delete from hanlog.recovery_attempt_limits where window_start < $1', [new Date(now.getTime() - 86_400_000).toISOString()]);
    await db.query(`update hanlog.users set recovery_previous_hash = null,recovery_request_hash = null,recovery_retry_expires_at = null,recovery_retry_version = null
      where recovery_retry_expires_at <= $1`, [now.toISOString()]);
    const paths = [...new Set([...references.map(r => r.reference_path), ...answers.map(r => r.media_path), ...abandoned.map(r => r.path)])];
    if (!paths.length) return 0;
    // Keep the DB pointers on failure, allowing the next job to retry partial removal.
    await getMediaStore().remove(paths);
    for (const row of references) await db.query('update hanlog.challenges set reference_path = null, reference_mime = null where id = $1', [row.id]);
    for (const row of answers) await db.query('update hanlog.challenge_responses set media_path = null where id = $1', [row.id]);
    await db.query('delete from hanlog.pending_media_deletions where path = any($1::text[])', [paths]);
    return paths.length;
  });
}
