import { getDb } from '../db';
import { ApiError } from '../errors';
import { SYSTEM_USER_ID, type Role, type User } from '../contracts';
type UserRow = { id: string; nickname: string; role: Role; created_at: Date | string };
const toUser = (r: UserRow): User => ({ id: r.id, nickname: r.nickname, role: r.role, createdAt: new Date(r.created_at).toISOString() });
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export async function createUser(input: { nickname: string; role: Role; ipHash: string }): Promise<User> {
  const rows = await (await getDb()).query<UserRow>('insert into hanlog.users (nickname, role, ip_hash) values ($1, $2, $3) returning *', [input.nickname, input.role, input.ipHash]);
  return toUser(rows[0]);
}
export async function getUser(id: string): Promise<User | null> {
  if (!isUuid(id)) return null;
  const [row] = await (await getDb()).query<UserRow>('select * from hanlog.users where id = $1', [id]);
  return row ? toUser(row) : null;
}
export async function updateUser(id: string, patch: { nickname?: string; role?: Role }): Promise<User> {
  if (!isUuid(id)) throw new ApiError('not_found');
  const [row] = await (await getDb()).query<UserRow>('update hanlog.users set nickname = coalesce($2, nickname), role = coalesce($3, role) where id = $1 returning *', [id, patch.nickname ?? null, patch.role ?? null]);
  if (!row) throw new ApiError('not_found');
  return toUser(row);
}
export async function countUsersSince(ipHash: string, sinceIso: string): Promise<number> {
  return (await (await getDb()).query<{ n: number }>('select count(*)::int as n from hanlog.users where ip_hash = $1 and created_at >= $2', [ipHash, sinceIso]))[0].n;
}
export async function deleteUserCascade(id: string, removeMedia?: (paths: string[]) => Promise<void>): Promise<string[]> {
  if (!isUuid(id)) return [];
  return (await getDb()).tx(async db => {
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [id]);
    // Answer uploads hold a share lock on their parent; lock parents before collecting paths.
    await db.query('select id from hanlog.challenges where author_id = $1 order by id for update', [id]);
    await db.query('select id from hanlog.challenge_responses where responder_id = $1 or challenge_id in (select id from hanlog.challenges where author_id = $1) order by id for update', [id]);
    const paths = await db.query<{ path: string | null }>(`
      select reference_path as path from hanlog.challenges where author_id = $1
      union select media_path as path from hanlog.challenge_responses
      where responder_id = $1 or challenge_id in (select id from hanlog.challenges where author_id = $1)`, [id]);
    const mediaPaths = paths.flatMap(r => r.path ? [r.path] : []);
    // Keep identity and pointers on failure so a partial storage deletion can be retried.
    if (removeMedia) await removeMedia(mediaPaths);
    // Preserve address/global spending limits without retaining the deleted profile ID.
    await db.query('update hanlog.scoring_calls set user_id = $2 where user_id = $1', [id, SYSTEM_USER_ID]);
    await db.query('delete from hanlog.users where id = $1', [id]);
    return mediaPaths;
  });
}
