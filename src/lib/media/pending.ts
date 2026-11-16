import { getDb, type Db } from '../db';
import { ApiError } from '../errors';
import { assertSafeMediaPath, getMediaStore } from './index';

export type MediaOwnership = { ownerId: string; challengeId: string; challengeAuthorId: string };
export async function lockMediaPaths(db: Db, paths: string[]): Promise<void> {
  for (const path of [...new Set(paths)].sort()) await db.query('select pg_advisory_xact_lock(hashtext($1))', [`media:${path}`]);
}
export async function queueMediaRemoval(path: string, ownership: MediaOwnership, db?: Db): Promise<void> {
  assertSafeMediaPath(path);
  const insert = (tx: Db) => tx.query(`insert into hanlog.pending_media_deletions(path, owner_id, challenge_id, challenge_author_id)
    values ($1,$2,$3,$4) on conflict(path) do update set owner_id = excluded.owner_id, challenge_id = excluded.challenge_id, challenge_author_id = excluded.challenge_author_id`, [path, ownership.ownerId, ownership.challengeId, ownership.challengeAuthorId]);
  if (db) { await insert(db); return; }
  await (await getDb()).tx(async tx => {
    // Registration cannot slip past profile deletion and introduce a late owned recording.
    await tx.query('select pg_advisory_xact_lock(hashtext($1))', [ownership.ownerId]);
    if (!(await tx.query('select id from hanlog.users where id = $1', [ownership.ownerId])).length) throw new ApiError('unauthenticated');
    const [challenge] = await tx.query<{ author_id: string }>('select author_id from hanlog.challenges where id = $1 for share', [ownership.challengeId]);
    if (!challenge || challenge.author_id !== ownership.challengeAuthorId) throw new ApiError('not_found');
    await insert(tx);
  });
}
/** Registers a post photo before upload, so a crash between storage and the database row cannot leave an owned orphan. */
export async function queuePostMediaRemoval(path: string, ownerId: string, db?: Db): Promise<void> {
  assertSafeMediaPath(path);
  const insert = (tx: Db) => tx.query(`insert into hanlog.pending_media_deletions(path, owner_id) values ($1,$2)
    on conflict(path) do update set owner_id = excluded.owner_id, challenge_id = null, challenge_author_id = null`, [path, ownerId]);
  if (db) { await insert(db); return; }
  await (await getDb()).tx(async tx => {
    await tx.query('select pg_advisory_xact_lock(hashtext($1))', [ownerId]);
    if (!(await tx.query('select id from hanlog.users where id = $1', [ownerId])).length) throw new ApiError('unauthenticated');
    await insert(tx);
  });
}
export async function finishMediaRemoval(path: string): Promise<boolean> {
  return (await getDb()).tx(async db => {
    await lockMediaPaths(db, [path]);
    const [row] = await db.query<{ referenced: boolean }>(`select exists(select 1 from hanlog.challenges where reference_path = $1)
      or exists(select 1 from hanlog.challenge_responses where media_path = $1)
      or exists(select 1 from hanlog.posts where image_path = $1) as referenced`, [path]);
    // A lost COMMIT reply does not mean rollback. Never compensate a committed file.
    if (row.referenced) return false;
    await getMediaStore().remove([path]);
    await db.query('delete from hanlog.pending_media_deletions where path = $1', [path]);
    return true;
  });
}
