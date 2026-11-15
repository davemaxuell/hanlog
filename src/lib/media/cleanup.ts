import { getConfig } from '../config';
import { getDb } from '../db';
import { getMediaStore } from './index';
export async function cleanupExpiredMedia(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - getConfig().retentionDays * 86400000).toISOString();
  return (await getDb()).tx(async db => {
    await db.query("select pg_advisory_xact_lock(hashtext('cleanup_media'))");
    // Parent rows first: account deletion also locks/deletes challenges before their answers.
    const references = await db.query<{ id: string; reference_path: string }>('select id, reference_path from hanlog.challenges where reference_path is not null and created_at <= $1 order by id for update', [cutoff]);
    const answers = await db.query<{ id: string; media_path: string }>('select id, media_path from hanlog.challenge_responses where media_path is not null and created_at <= $1 order by id for update', [cutoff]);
    const paths = [...new Set([...references.map(r => r.reference_path), ...answers.map(r => r.media_path)])];
    if (!paths.length) return 0;
    // Keep the DB pointers on failure, allowing the next job to retry partial removal.
    await getMediaStore().remove(paths);
    for (const row of references) await db.query('update hanlog.challenges set reference_path = null, reference_mime = null where id = $1', [row.id]);
    for (const row of answers) await db.query('update hanlog.challenge_responses set media_path = null where id = $1', [row.id]);
    return paths.length;
  });
}
