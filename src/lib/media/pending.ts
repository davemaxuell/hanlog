import { getDb, type Db } from '../db';
import { assertSafeMediaPath, getMediaStore } from './index';

export async function queueMediaRemoval(path: string, db?: Db): Promise<void> {
  assertSafeMediaPath(path);
  await (db ?? await getDb()).query('insert into hanlog.pending_media_deletions(path) values ($1) on conflict(path) do nothing', [path]);
}
export async function finishMediaRemoval(path: string): Promise<void> {
  await getMediaStore().remove([path]);
  await (await getDb()).query('delete from hanlog.pending_media_deletions where path = $1', [path]);
}
